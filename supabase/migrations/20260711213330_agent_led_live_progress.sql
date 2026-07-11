-- Additive ChildProgress storage for live projections, evidence, check-ins,
-- conflicts, and internal snapshots.
--
-- Direct server SQL through mapDb is the only mutation path. Authenticated
-- Data API callers receive family-scoped SELECT policies only. There are no
-- INSERT, UPDATE, or DELETE policies on these tables.
--
-- child_answers and child_reports remain compatibility projections while
-- callers move behind the ChildProgress module. This migration backfills only
-- real evidence-bearing answers and does not fabricate quotes, adult attribution, or
-- historical snapshots.

create table public.child_progress_evidence (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  item_id text not null,
  answer text not null
    check (answer in ('easily', 'getting_there', 'not_yet')),
  source text not null
    check (
      source in (
        'journal',
        'conversation',
        'check_in',
        'checklist',
        'correction',
        'legacy',
        'onboarding_walk',
        'report_correction'
      )
    ),
  member_user_id uuid references auth.users (id) on delete set null,
  quote text check (quote is null or char_length(quote) <= 500),
  check_in_id uuid,
  supersedes_id uuid references public.child_progress_evidence (id),
  superseded_at timestamptz,
  observed_at timestamptz not null default now(),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint child_progress_evidence_child_idempotency_key
    unique (child_id, idempotency_key)
);

create table public.child_progress_live (
  child_id uuid primary key references public.children (id) on delete cascade,
  projection jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  bank_version text not null,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  open_conflict_count integer not null default 0
    check (open_conflict_count >= 0),
  projected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.progress_check_ins (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  purpose text not null
    check (
      purpose in (
        'whole_map_refresh',
        'subject_deep_dive',
        'age_refresh',
        'journal_followup'
      )
    ),
  scope jsonb not null default '{}'::jsonb,
  state text not null default 'active'
    check (state in ('active', 'paused', 'completed', 'stopped')),
  active_member_user_id uuid references auth.users (id) on delete set null,
  prompt_recipient_member_user_id uuid
    references auth.users (id) on delete set null,
  revision integer not null default 0 check (revision >= 0),
  current_item_id text,
  current_delivery_id uuid
    references public.conversation_deliveries (id) on delete set null,
  episode_id uuid
    references public.conversation_episodes (id) on delete set null,
  opened_at timestamptz not null default now(),
  paused_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Added after both tables exist to keep the create order acyclic.
alter table public.child_progress_evidence
  add constraint child_progress_evidence_check_in_id_fkey
  foreign key (check_in_id)
  references public.progress_check_ins (id)
  on delete set null;

create table public.progress_check_in_responses (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null
    references public.progress_check_ins (id) on delete cascade,
  revision integer not null check (revision > 0),
  item_id text not null,
  answer text not null
    check (
      answer in (
        'easily',
        'getting_there',
        'not_yet',
        'not_sure',
        'skip'
      )
    ),
  member_user_id uuid references auth.users (id) on delete set null,
  delivery_id uuid
    references public.conversation_deliveries (id) on delete set null,
  inbound_message_id uuid
    references public.conversation_messages (id) on delete set null,
  is_evidence boolean not null default false,
  evidence_id uuid
    references public.child_progress_evidence (id) on delete set null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint progress_check_in_responses_idempotency_key
    unique (check_in_id, idempotency_key),
  constraint progress_check_in_responses_revision_key
    unique (check_in_id, revision)
);

create table public.child_progress_conflicts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  item_id text not null,
  evidence_id_a uuid not null
    references public.child_progress_evidence (id),
  evidence_id_b uuid not null
    references public.child_progress_evidence (id),
  member_user_id_a uuid references auth.users (id) on delete set null,
  member_user_id_b uuid references auth.users (id) on delete set null,
  state text not null default 'open'
    check (state in ('open', 'resolved')),
  resolved_answer text
    check (
      resolved_answer is null
      or resolved_answer in ('easily', 'getting_there', 'not_yet')
    ),
  resolved_evidence_id uuid
    references public.child_progress_evidence (id) on delete set null,
  resolved_by_member_user_id uuid
    references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.child_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  trigger text not null
    check (trigger in ('check_in_group', 'correction', 'legacy')),
  check_in_id uuid
    references public.progress_check_ins (id) on delete set null,
  evidence_ids uuid[] not null default '{}'::uuid[],
  age_months integer not null check (age_months >= 0),
  bank_version text not null,
  scorer_version text not null,
  projection jsonb not null,
  scores jsonb not null,
  created_at timestamptz not null default now()
);

create index child_progress_evidence_child_item_time_idx
  on public.child_progress_evidence
    (child_id, item_id, observed_at desc);
create index child_progress_evidence_child_active_idx
  on public.child_progress_evidence
    (child_id, observed_at desc)
  where superseded_at is null;
create index child_progress_live_projected_at_idx
  on public.child_progress_live (projected_at desc);
create index progress_check_ins_child_state_idx
  on public.progress_check_ins (child_id, state, updated_at desc);
create unique index progress_check_ins_one_open_child_idx
  on public.progress_check_ins (child_id)
  where state in ('active', 'paused');
create index progress_check_in_responses_check_in_idx
  on public.progress_check_in_responses (check_in_id, created_at);
create index child_progress_conflicts_child_state_idx
  on public.child_progress_conflicts (child_id, state);
create unique index child_progress_conflicts_one_open_topic_idx
  on public.child_progress_conflicts (child_id, item_id)
  where state = 'open';
create index child_progress_snapshots_child_time_idx
  on public.child_progress_snapshots (child_id, created_at desc);
create unique index child_progress_snapshots_check_in_idx
  on public.child_progress_snapshots (check_in_id)
  where check_in_id is not null and trigger = 'check_in_group';

alter table public.child_progress_evidence enable row level security;
alter table public.child_progress_live enable row level security;
alter table public.progress_check_ins enable row level security;
alter table public.progress_check_in_responses enable row level security;
alter table public.child_progress_conflicts enable row level security;
alter table public.child_progress_snapshots enable row level security;

create policy "members read child progress evidence"
  on public.child_progress_evidence
  for select
  to authenticated
  using (public.is_child_family_member(child_id));

create policy "members read live child progress"
  on public.child_progress_live
  for select
  to authenticated
  using (public.is_child_family_member(child_id));

create policy "members read progress check-ins"
  on public.progress_check_ins
  for select
  to authenticated
  using (public.is_child_family_member(child_id));

create policy "members read progress check-in responses"
  on public.progress_check_in_responses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.progress_check_ins check_in
      where check_in.id = progress_check_in_responses.check_in_id
        and public.is_child_family_member(check_in.child_id)
    )
  );

create policy "members read child progress conflicts"
  on public.child_progress_conflicts
  for select
  to authenticated
  using (public.is_child_family_member(child_id));

create policy "members read child progress snapshots"
  on public.child_progress_snapshots
  for select
  to authenticated
  using (public.is_child_family_member(child_id));

-- Keep SELECT callable for anonymous probes so RLS returns an empty set.
-- Mutations are denied both by missing policies and by table privileges.
revoke all on table public.child_progress_evidence
  from public, anon, authenticated;
revoke all on table public.child_progress_live
  from public, anon, authenticated;
revoke all on table public.progress_check_ins
  from public, anon, authenticated;
revoke all on table public.progress_check_in_responses
  from public, anon, authenticated;
revoke all on table public.child_progress_conflicts
  from public, anon, authenticated;
revoke all on table public.child_progress_snapshots
  from public, anon, authenticated;

grant select on table public.child_progress_evidence to anon, authenticated;
grant select on table public.child_progress_live to anon, authenticated;
grant select on table public.progress_check_ins to anon, authenticated;
grant select on table public.progress_check_in_responses to anon, authenticated;
grant select on table public.child_progress_conflicts to anon, authenticated;
grant select on table public.child_progress_snapshots to anon, authenticated;

comment on table public.child_progress_evidence is
  'Append-only ChildProgress evidence. Writes use server-only mapDb paths. child_answers remains a compatibility projection.';
comment on table public.child_progress_live is
  'Current ChildProgress projection. Writes use server-only mapDb paths. child_reports remains a compatibility projection.';
comment on table public.progress_check_ins is
  'Durable ChildProgress check-in state. Authenticated Data API callers have family-scoped read access only.';
comment on table public.progress_check_in_responses is
  'Immutable check-in responses. Writes use server-only mapDb paths and child scope is inherited from the check-in.';
comment on table public.child_progress_conflicts is
  'ChildProgress evidence conflicts. Writes and resolutions use server-only mapDb paths.';
comment on table public.child_progress_snapshots is
  'Internal ChildProgress projection history. Writes use server-only mapDb paths.';

-- child_answers.source was unconstrained. Preserve supported provenance and
-- normalize null or older labels to legacy so the stricter ledger check holds.
insert into public.child_progress_evidence (
  child_id,
  item_id,
  answer,
  source,
  observed_at,
  idempotency_key,
  created_at
)
select
  answer.child_id,
  answer.question_id,
  answer.answer,
  coalesce(
    case
      when answer.source in (
        'journal',
        'conversation',
        'check_in',
        'checklist',
        'correction',
        'legacy',
        'onboarding_walk',
        'report_correction'
      )
      then answer.source
    end,
    'legacy'
  ),
  answer.answered_at,
  'legacy:' || answer.child_id::text || ':' || answer.question_id,
  answer.answered_at
from public.child_answers answer
where answer.answer in ('easily', 'getting_there', 'not_yet')
on conflict (child_id, idempotency_key) do nothing;
