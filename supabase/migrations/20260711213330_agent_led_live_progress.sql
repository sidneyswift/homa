-- Additive ChildProgress storage for live projections, evidence, operation
-- receipts, source revisions, check-ins, conflicts, and internal snapshots.
--
-- Direct server SQL through mapDb is the only mutation path. Authenticated
-- Data API callers receive family-scoped SELECT policies only. There are no
-- INSERT, UPDATE, or DELETE policies on these tables.
--
-- child_answers and child_reports remain compatibility projections while
-- callers move behind the ChildProgress module. This migration backfills only
-- real evidence-bearing answers and does not fabricate quotes, adult
-- attribution, or historical snapshots.

create schema if not exists private;

-- Composite identities make every relationship prove family ownership inside
-- Postgres. Each existing id is already globally unique, so these indexes are
-- additive and safe.
create unique index children_progress_identity_idx
  on public.children (id, family_id);
create unique index conversation_episodes_progress_identity_idx
  on public.conversation_episodes (id, family_id);
create unique index conversation_deliveries_progress_identity_idx
  on public.conversation_deliveries (id, family_id);
create unique index conversation_messages_progress_identity_idx
  on public.conversation_messages (id, family_id);

create or replace function private.normalize_child_progress_source(
  source_value text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case source_value
    when 'journal' then 'journal'
    when 'conversation' then 'conversation'
    when 'check_in' then 'check_in'
    when 'checklist' then 'checklist'
    when 'deep_dive' then 'deep_dive'
    when 'correction' then 'correction'
    when 'report_correction' then 'report_correction'
    when 'report_probe' then 'report_probe'
    when 'recheck' then 'recheck'
    when 'onboarding_walk' then 'onboarding_walk'
    when 'legacy' then 'legacy'
    else 'legacy'
  end
$$;

revoke all on function private.normalize_child_progress_source(text)
  from public, anon, authenticated;

create or replace function private.child_progress_reconciliation_lock_key()
returns bigint
language sql
immutable
set search_path = ''
as $$
  select 72460111213330::bigint
$$;

revoke all on function private.child_progress_reconciliation_lock_key()
  from public, anon, authenticated;

create table public.child_progress_evidence (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null,
  family_id uuid not null,
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
        'deep_dive',
        'correction',
        'report_correction',
        'report_probe',
        'recheck',
        'onboarding_walk',
        'legacy'
      )
    ),
  member_user_id uuid references auth.users (id) on delete set null,
  adult_display_name_snapshot varchar(120)
    check (
      adult_display_name_snapshot is null
      or btrim(adult_display_name_snapshot) <> ''
    ),
  quote text check (quote is null or char_length(quote) <= 500),
  channel text
    check (
      channel is null
      or channel in ('web', 'sms', 'email')
    ),
  message_id uuid,
  provider_message_id text
    check (
      provider_message_id is null
      or btrim(provider_message_id) <> ''
    ),
  check_in_id uuid,
  supersedes_id uuid,
  superseded_at timestamptz,
  observed_at timestamptz not null default now(),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint child_progress_evidence_identity_key
    unique (id, child_id, family_id),
  constraint child_progress_evidence_child_idempotency_key
    unique (child_id, family_id, idempotency_key),
  constraint child_progress_evidence_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred,
  constraint child_progress_evidence_message_fkey
    foreign key (message_id, family_id)
    references public.conversation_messages (id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred,
  constraint child_progress_evidence_message_shape
    check (
      (
        channel is null
        and message_id is null
        and provider_message_id is null
      )
      or
      channel is not null
    ),
  constraint child_progress_evidence_supersedes_fkey
    foreign key (supersedes_id, child_id, family_id)
    references public.child_progress_evidence (id, child_id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred
);

create table public.child_progress_operations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null,
  family_id uuid not null,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  status text not null
    check (
      status in (
        'pending',
        'activity_only',
        'no_match',
        'ambiguous',
        'recorded',
        'conflict_open',
        'conflict_pending',
        'conflict_resolved',
        'answers_corrected',
        'undone'
      )
    ),
  evidence_ids uuid[] not null default '{}'::uuid[],
  affected_item_ids text[] not null default '{}'::text[],
  conflict_ids uuid[] not null default '{}'::uuid[],
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint child_progress_operations_idempotency_key
    unique (child_id, family_id, idempotency_key),
  constraint child_progress_operations_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred
);

create table public.child_progress_revisions (
  child_id uuid not null,
  family_id uuid not null,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  primary key (child_id, family_id),
  constraint child_progress_revisions_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred
);

create table public.child_progress_live (
  child_id uuid primary key,
  family_id uuid not null,
  projection jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  bank_version text not null,
  projection_version text not null,
  projection_date date not null,
  source_revision bigint not null check (source_revision >= 0),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  open_conflict_count integer not null default 0
    check (open_conflict_count >= 0),
  projected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_progress_live_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred
);

create table public.progress_check_ins (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null,
  family_id uuid not null,
  idempotency_key text not null default gen_random_uuid()::text
    check (btrim(idempotency_key) <> ''),
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
  pause_reason text
    check (
      pause_reason is null
      or pause_reason in (
        'topic_change',
        'explicit_pause',
        'delivery_uncertain',
        'delivery_failed',
        'conflict',
        'member_removed'
      )
    ),
  active_member_user_id uuid references auth.users (id) on delete set null,
  prompt_recipient_member_user_id uuid
    references auth.users (id) on delete set null,
  revision integer not null default 1 check (revision >= 1),
  current_item_id text,
  current_delivery_id uuid,
  episode_id uuid,
  pending_runtime_session_id text,
  pending_turn_id text,
  opened_at timestamptz not null default now(),
  paused_at timestamptz,
  completed_at timestamptz,
  stopped_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint progress_check_ins_identity_key
    unique (id, child_id, family_id),
  constraint progress_check_ins_child_idempotency_key
    unique (child_id, family_id, idempotency_key),
  constraint progress_check_ins_state_shape
    check (
      (
        state = 'active'
        and current_item_id is not null
        and pause_reason is null
        and paused_at is null
        and completed_at is null
        and stopped_at is null
        and pending_runtime_session_id is not null
        and btrim(pending_runtime_session_id) <> ''
        and pending_turn_id is not null
        and btrim(pending_turn_id) <> ''
      )
      or
      (
        state = 'paused'
        and current_item_id is not null
        and pause_reason is not null
        and paused_at is not null
        and completed_at is null
        and stopped_at is null
        and (
          (
            pause_reason = 'conflict'
            and pending_runtime_session_id is not null
            and btrim(pending_runtime_session_id) <> ''
            and pending_turn_id is not null
            and btrim(pending_turn_id) <> ''
          )
          or
          (
            pause_reason <> 'conflict'
            and pending_runtime_session_id is null
            and pending_turn_id is null
          )
        )
        and (
          pause_reason <> 'member_removed'
          or (
            active_member_user_id is null
            and prompt_recipient_member_user_id is null
            and current_delivery_id is null
          )
        )
      )
      or
      (
        state = 'completed'
        and current_item_id is null
        and pause_reason is null
        and paused_at is null
        and completed_at is not null
        and stopped_at is null
        and pending_runtime_session_id is null
        and pending_turn_id is null
      )
      or
      (
        state = 'stopped'
        and current_item_id is null
        and pause_reason is null
        and paused_at is null
        and completed_at is null
        and stopped_at is not null
        and pending_runtime_session_id is null
        and pending_turn_id is null
      )
    ),
  constraint progress_check_ins_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred,
  constraint progress_check_ins_current_delivery_fkey
    foreign key (current_delivery_id, family_id)
    references public.conversation_deliveries (id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred,
  constraint progress_check_ins_episode_fkey
    foreign key (episode_id, family_id)
    references public.conversation_episodes (id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred
);

-- Added after both tables exist to keep the create order acyclic.
alter table public.child_progress_evidence
  add constraint child_progress_evidence_check_in_id_fkey
  foreign key (check_in_id, child_id, family_id)
  references public.progress_check_ins (id, child_id, family_id)
  on update cascade
  on delete no action
  deferrable initially deferred;

create table public.progress_check_in_responses (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null,
  family_id uuid not null,
  check_in_id uuid not null,
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
  delivery_id uuid,
  channel text not null default 'web'
    check (channel in ('web', 'sms', 'email', 'dispatch', 'voice')),
  provider_message_id text,
  inbound_message_id uuid not null,
  is_evidence boolean not null default false,
  evidence_id uuid,
  idempotency_key text not null,
  result jsonb not null default '{"status":"pending"}'::jsonb
    check (
      jsonb_typeof(result) = 'object'
      and result ->> 'status' in (
        'pending',
        'advanced',
        'completed',
        'conflict_open'
      )
    ),
  created_at timestamptz not null default now(),
  constraint progress_check_in_responses_idempotency_key
    unique (check_in_id, idempotency_key),
  constraint progress_check_in_responses_revision_key
    unique (check_in_id, revision),
  constraint progress_check_in_responses_evidence_shape
    check (
      (
        result ->> 'status' = 'pending'
        and not is_evidence
        and evidence_id is null
      )
      or
      (
        (
          answer in ('easily', 'getting_there', 'not_yet')
          and is_evidence
          and evidence_id is not null
        )
        or
        (
          answer in ('not_sure', 'skip')
          and not is_evidence
          and evidence_id is null
        )
      )
    ),
  constraint progress_check_in_responses_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred,
  constraint progress_check_in_responses_check_in_fkey
    foreign key (check_in_id, child_id, family_id)
    references public.progress_check_ins (id, child_id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred,
  constraint progress_check_in_responses_delivery_fkey
    foreign key (delivery_id, family_id)
    references public.conversation_deliveries (id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred,
  constraint progress_check_in_responses_inbound_message_fkey
    foreign key (inbound_message_id, family_id)
    references public.conversation_messages (id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred,
  constraint progress_check_in_responses_evidence_fkey
    foreign key (evidence_id, child_id, family_id)
    references public.child_progress_evidence (id, child_id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred
);

create table public.child_progress_conflicts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null,
  family_id uuid not null,
  item_id text not null,
  evidence_id_a uuid not null,
  evidence_id_b uuid not null,
  state text not null default 'open'
    check (state in ('open', 'resolved')),
  resolved_answer text
    check (
      resolved_answer is null
      or resolved_answer in ('easily', 'getting_there', 'not_yet')
    ),
  resolved_evidence_id uuid,
  resolved_by_member_user_id uuid
    references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint child_progress_conflicts_distinct_evidence
    check (evidence_id_a <> evidence_id_b),
  constraint child_progress_conflicts_resolution_shape
    check (
      (
        state = 'open'
        and resolved_answer is null
        and resolved_evidence_id is null
        and resolved_by_member_user_id is null
        and resolved_at is null
      )
      or
      (
        state = 'resolved'
        and resolved_answer is not null
        and resolved_evidence_id is not null
        and resolved_at is not null
      )
    ),
  constraint child_progress_conflicts_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred,
  constraint child_progress_conflicts_evidence_a_fkey
    foreign key (evidence_id_a, child_id, family_id)
    references public.child_progress_evidence (id, child_id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred,
  constraint child_progress_conflicts_evidence_b_fkey
    foreign key (evidence_id_b, child_id, family_id)
    references public.child_progress_evidence (id, child_id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred,
  constraint child_progress_conflicts_resolved_evidence_fkey
    foreign key (resolved_evidence_id, child_id, family_id)
    references public.child_progress_evidence (id, child_id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred
);

create table public.child_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null,
  family_id uuid not null,
  snapshot_kind text not null
    check (snapshot_kind in ('check_in_group', 'correction', 'legacy')),
  check_in_id uuid,
  evidence_ids uuid[] not null default '{}'::uuid[],
  age_months integer not null check (age_months >= 0),
  bank_version text not null,
  scorer_version text not null,
  projection jsonb not null,
  scores jsonb not null,
  created_at timestamptz not null default now(),
  constraint child_progress_snapshots_check_in_shape
    check (snapshot_kind <> 'check_in_group' or check_in_id is not null),
  constraint child_progress_snapshots_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred,
  constraint child_progress_snapshots_check_in_fkey
    foreign key (check_in_id, child_id, family_id)
    references public.progress_check_ins (id, child_id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred
);

create table public.map_walk_prompts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null,
  family_id uuid not null,
  subject_id text not null check (btrim(subject_id) <> ''),
  topic_id text not null check (btrim(topic_id) <> ''),
  sitting integer not null check (sitting >= 0),
  source_revision bigint not null check (source_revision >= 0),
  item_observed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  terminal_reason text
    check (
      terminal_reason is null
      or terminal_reason in (
        'answered',
        'expired',
        'stale',
        'stopped'
      )
    ),
  answer text
    check (
      answer is null
      or answer in (
        'easily',
        'getting_there',
        'not_yet',
        'not_sure',
        'skip'
      )
    ),
  idempotency_key text,
  payload_hash text
    check (
      payload_hash is null
      or payload_hash ~ '^[0-9a-f]{64}$'
    ),
  result jsonb,
  constraint map_walk_prompts_expiry_check
    check (expires_at > created_at),
  constraint map_walk_prompts_consumption_shape
    check (
      (
        consumed_at is null
        and terminal_reason is null
        and answer is null
        and idempotency_key is null
        and payload_hash is null
        and result is null
      )
      or
      (
        consumed_at is not null
        and terminal_reason = 'answered'
        and answer is not null
        and btrim(idempotency_key) <> ''
        and payload_hash is not null
        and jsonb_typeof(result) = 'object'
      )
      or
      (
        consumed_at is not null
        and terminal_reason in ('expired', 'stale', 'stopped')
        and answer is null
        and btrim(idempotency_key) <> ''
        and payload_hash is not null
        and jsonb_typeof(result) = 'object'
      )
    ),
  constraint map_walk_prompts_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred
);

create index child_progress_evidence_child_item_time_idx
  on public.child_progress_evidence
    (child_id, family_id, item_id, observed_at desc);
create index child_progress_evidence_child_active_idx
  on public.child_progress_evidence
    (child_id, family_id, item_id, observed_at desc)
  where superseded_at is null;
create index child_progress_evidence_family_time_idx
  on public.child_progress_evidence (family_id, created_at desc);
create index child_progress_evidence_member_idx
  on public.child_progress_evidence (member_user_id, family_id)
  where member_user_id is not null;
create index child_progress_evidence_check_in_fkey_idx
  on public.child_progress_evidence (check_in_id, child_id, family_id)
  where check_in_id is not null;
create index child_progress_evidence_message_fkey_idx
  on public.child_progress_evidence (message_id, family_id)
  where message_id is not null;
create index child_progress_evidence_supersedes_fkey_idx
  on public.child_progress_evidence (supersedes_id, child_id, family_id)
  where supersedes_id is not null;
create index child_progress_operations_family_time_idx
  on public.child_progress_operations (family_id, created_at desc);
create index child_progress_operations_family_id_idx
  on public.child_progress_operations (family_id, id);
create index child_progress_operations_child_status_idx
  on public.child_progress_operations
    (child_id, family_id, status, created_at desc);
create index child_progress_revisions_family_updated_idx
  on public.child_progress_revisions (family_id, updated_at desc);
create index child_progress_live_child_fkey_idx
  on public.child_progress_live (child_id, family_id);
create index child_progress_live_projected_at_idx
  on public.child_progress_live (family_id, projected_at desc);
create index progress_check_ins_child_state_idx
  on public.progress_check_ins
    (child_id, family_id, state, updated_at desc);
create index progress_check_ins_family_state_idx
  on public.progress_check_ins (family_id, state, updated_at desc);
create index progress_check_ins_family_idempotency_idx
  on public.progress_check_ins
    (family_id, child_id, idempotency_key);
create unique index progress_check_ins_one_open_child_idx
  on public.progress_check_ins (child_id, family_id)
  where state in ('active', 'paused');
create index progress_check_ins_active_member_idx
  on public.progress_check_ins (active_member_user_id, family_id)
  where active_member_user_id is not null;
create index progress_check_ins_prompt_recipient_idx
  on public.progress_check_ins (prompt_recipient_member_user_id, family_id)
  where prompt_recipient_member_user_id is not null;
create index progress_check_ins_current_delivery_fkey_idx
  on public.progress_check_ins (current_delivery_id, family_id)
  where current_delivery_id is not null;
create index progress_check_ins_episode_fkey_idx
  on public.progress_check_ins (episode_id, family_id)
  where episode_id is not null;
create index progress_check_ins_pending_prompt_idx
  on public.progress_check_ins (
    family_id,
    prompt_recipient_member_user_id,
    episode_id,
    pending_runtime_session_id,
    pending_turn_id
  )
  where state = 'active' and current_delivery_id is null;
create index progress_check_in_responses_child_time_idx
  on public.progress_check_in_responses
    (child_id, family_id, created_at);
create index progress_check_in_responses_check_in_fkey_idx
  on public.progress_check_in_responses
    (check_in_id, child_id, family_id);
create index progress_check_in_responses_member_idx
  on public.progress_check_in_responses (member_user_id, family_id)
  where member_user_id is not null;
create index progress_check_in_responses_delivery_fkey_idx
  on public.progress_check_in_responses (delivery_id, family_id)
  where delivery_id is not null;
create index progress_check_in_responses_inbound_fkey_idx
  on public.progress_check_in_responses (inbound_message_id, family_id)
  where inbound_message_id is not null;
create unique index progress_check_in_responses_inbound_message_idx
  on public.progress_check_in_responses (family_id, inbound_message_id)
  where inbound_message_id is not null;
create unique index progress_check_in_responses_provider_message_idx
  on public.progress_check_in_responses
    (family_id, channel, provider_message_id)
  where provider_message_id is not null;
create index progress_check_in_responses_evidence_fkey_idx
  on public.progress_check_in_responses
    (evidence_id, child_id, family_id)
  where evidence_id is not null;
create index child_progress_conflicts_child_state_idx
  on public.child_progress_conflicts (child_id, family_id, state);
create index child_progress_conflicts_evidence_a_fkey_idx
  on public.child_progress_conflicts
    (evidence_id_a, child_id, family_id);
create index child_progress_conflicts_evidence_b_fkey_idx
  on public.child_progress_conflicts
    (evidence_id_b, child_id, family_id);
create index child_progress_conflicts_resolved_evidence_idx
  on public.child_progress_conflicts
    (resolved_evidence_id, child_id, family_id)
  where resolved_evidence_id is not null;
create index child_progress_conflicts_resolved_by_member_idx
  on public.child_progress_conflicts
    (resolved_by_member_user_id, family_id)
  where resolved_by_member_user_id is not null;
create unique index child_progress_conflicts_one_open_topic_idx
  on public.child_progress_conflicts (child_id, family_id, item_id)
  where state = 'open';
create index child_progress_snapshots_child_time_idx
  on public.child_progress_snapshots
    (child_id, family_id, created_at desc);
create index child_progress_snapshots_check_in_fkey_idx
  on public.child_progress_snapshots (check_in_id, child_id, family_id)
  where check_in_id is not null;
create unique index child_progress_snapshots_check_in_idx
  on public.child_progress_snapshots (check_in_id)
  where check_in_id is not null and snapshot_kind = 'check_in_group';
create index map_walk_prompts_child_subject_time_idx
  on public.map_walk_prompts
    (child_id, family_id, subject_id, created_at desc);
create index map_walk_prompts_active_expiry_idx
  on public.map_walk_prompts (expires_at)
  where consumed_at is null;
create unique index map_walk_prompts_one_active_subject_idx
  on public.map_walk_prompts (
    child_id, family_id, subject_id
  )
  where consumed_at is null;
create index map_walk_prompts_family_time_idx
  on public.map_walk_prompts (family_id, created_at desc);

create or replace function private.bump_child_progress_revision(
  target_child_id uuid,
  target_family_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.child_progress_revisions (
    child_id,
    family_id,
    revision,
    updated_at
  )
  select target_child_id, target_family_id, 1, clock_timestamp()
  where exists (
    select 1
    from public.children child
    where child.id = target_child_id
      and child.family_id = target_family_id
  )
  on conflict (child_id, family_id) do update
  set revision = public.child_progress_revisions.revision + 1,
      updated_at = excluded.updated_at
$$;

create or replace function private.bump_child_progress_row_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.child_id is not distinct from old.child_id
    and new.family_id is distinct from old.family_id
  then
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform private.bump_child_progress_revision(
      old.child_id,
      old.family_id
    );
    return old;
  end if;
  perform private.bump_child_progress_revision(
    new.child_id,
    new.family_id
  );
  return new;
end
$$;

create or replace function private.bump_child_answer_progress_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_family_id uuid;
  new_family_id uuid;
begin
  if tg_op <> 'INSERT' then
    select child.family_id
    into old_family_id
    from public.children child
    where child.id = old.child_id;
  end if;
  if tg_op <> 'DELETE' then
    select child.family_id
    into new_family_id
    from public.children child
    where child.id = new.child_id;
  end if;

  if tg_op = 'UPDATE'
    and old.child_id is distinct from new.child_id
    and new.child_id < old.child_id
  then
    if new_family_id is not null then
      perform private.bump_child_progress_revision(
        new.child_id,
        new_family_id
      );
    end if;
    if old_family_id is not null then
      perform private.bump_child_progress_revision(
        old.child_id,
        old_family_id
      );
    end if;
  else
    if old_family_id is not null then
      perform private.bump_child_progress_revision(
        old.child_id,
        old_family_id
      );
    end if;
    if new_family_id is not null
      and (
        tg_op <> 'UPDATE'
        or new.child_id is distinct from old.child_id
      )
    then
      perform private.bump_child_progress_revision(
        new.child_id,
        new_family_id
      );
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create or replace function private.bump_child_identity_progress_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name
    or new.birth_month is distinct from old.birth_month
    or new.family_id is distinct from old.family_id
  then
    perform private.bump_child_progress_revision(new.id, new.family_id);
  end if;
  return new;
end
$$;

create or replace function private.bump_family_progress_revisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.time_zone is distinct from old.time_zone then
    insert into public.child_progress_revisions (
      child_id,
      family_id,
      revision,
      updated_at
    )
    select child.id, child.family_id, 1, clock_timestamp()
    from public.children child
    where child.family_id = new.id
    order by child.id
    on conflict (child_id, family_id) do update
    set revision = public.child_progress_revisions.revision + 1,
        updated_at = excluded.updated_at;
  end if;
  return new;
end
$$;

create or replace function private.bump_member_progress_revisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.display_name is not distinct from old.display_name
  then
    return new;
  end if;
  insert into public.child_progress_revisions (
    child_id,
    family_id,
    revision,
    updated_at
  )
  select evidence.child_id, evidence.family_id, 1, clock_timestamp()
  from public.child_progress_evidence evidence
  where evidence.family_id = old.family_id
    and evidence.member_user_id = old.user_id
  group by evidence.child_id, evidence.family_id
  order by evidence.child_id
  on conflict (child_id, family_id) do update
  set revision = public.child_progress_revisions.revision + 1,
      updated_at = excluded.updated_at;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create or replace function private.pause_check_ins_for_removed_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transition_at timestamptz := clock_timestamp();
begin
  if tg_op = 'UPDATE'
    and new.family_id is not distinct from old.family_id
    and new.user_id is not distinct from old.user_id
  then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock_shared(
    private.child_progress_reconciliation_lock_key()
  );

  perform child.id
  from public.children child
  where child.family_id = old.family_id
    and exists (
      select 1
      from public.progress_check_ins check_in
      where check_in.child_id = child.id
        and check_in.family_id = child.family_id
        and check_in.state in ('active', 'paused')
        and (
          check_in.active_member_user_id = old.user_id
          or check_in.prompt_recipient_member_user_id = old.user_id
        )
    )
  order by child.id
  for update;

  insert into public.child_progress_revisions (
    child_id, family_id, revision, updated_at
  )
  select child.id, child.family_id, 0, transition_at
  from public.children child
  where child.family_id = old.family_id
    and exists (
      select 1
      from public.progress_check_ins check_in
      where check_in.child_id = child.id
        and check_in.family_id = child.family_id
        and check_in.state in ('active', 'paused')
        and (
          check_in.active_member_user_id = old.user_id
          or check_in.prompt_recipient_member_user_id = old.user_id
        )
    )
  order by child.id
  on conflict (child_id, family_id) do nothing;

  perform revision.child_id
  from public.child_progress_revisions revision
  where revision.family_id = old.family_id
    and exists (
      select 1
      from public.progress_check_ins check_in
      where check_in.child_id = revision.child_id
        and check_in.family_id = revision.family_id
        and check_in.state in ('active', 'paused')
        and (
          check_in.active_member_user_id = old.user_id
          or check_in.prompt_recipient_member_user_id = old.user_id
        )
    )
  order by revision.child_id
  for update;

  perform set_config(
    'homa.child_progress_member_removal',
    'on',
    true
  );

  with transitioned as (
    update public.progress_check_ins check_in
    set state = 'paused',
        pause_reason = 'member_removed',
        active_member_user_id = null,
        prompt_recipient_member_user_id = null,
        current_delivery_id = null,
        pending_runtime_session_id = null,
        pending_turn_id = null,
        revision = check_in.revision + 1,
        paused_at = transition_at,
        completed_at = null,
        stopped_at = null,
        updated_at = transition_at
    where check_in.family_id = old.family_id
      and check_in.state in ('active', 'paused')
      and (
        check_in.active_member_user_id = old.user_id
        or check_in.prompt_recipient_member_user_id = old.user_id
      )
    returning check_in.child_id, check_in.family_id
  )
  insert into public.events (name, props, family_id)
  select
    'progress.checkin_paused',
    pg_catalog.jsonb_build_object(
      'family_id', transitioned.family_id,
      'child_id', transitioned.child_id,
      'reason', 'member_removed'
    ),
    transitioned.family_id
  from transitioned;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create or replace function private.validate_progress_check_in_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pause_reason = 'member_removed'
    and (
      tg_op = 'INSERT'
      or old.pause_reason is distinct from 'member_removed'
    )
    and lower(
      coalesce(
        current_setting(
          'homa.child_progress_member_removal',
          true
        ),
        'off'
      )
    ) not in ('1', 'on', 'true', 'yes')
  then
    raise exception using
      errcode = '23514',
      message = 'Only the membership-removal trigger can create member_removed state';
  end if;
  return new;
end
$$;

create or replace function private.validate_child_progress_family_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row jsonb;
  old_row jsonb := '{}'::jsonb;
  family_uuid uuid;
  member_column text;
  member_uuid uuid;
begin
  if tg_op = 'UPDATE' then
    old_row := to_jsonb(old);
  end if;
  execute format(
    'select to_jsonb(target) from %s target where id = $1',
    tg_relid::regclass
  )
  into current_row
  using new.id;

  -- Deferred trigger events can capture intermediate SET NULL states when one
  -- Auth deletion updates several foreign-key columns. Validate the row as it
  -- exists now, after every statement in the transaction has run.
  if current_row is null then
    return new;
  end if;
  family_uuid := (current_row ->> 'family_id')::uuid;

  foreach member_column in array tg_argv loop
    member_uuid := nullif(current_row ->> member_column, '')::uuid;
    if member_uuid is not null
      and member_uuid is distinct from
        nullif(old_row ->> member_column, '')::uuid
      and not exists (
        select 1
        from public.family_members member
        where member.family_id = family_uuid
          and member.user_id = member_uuid
      )
    then
      raise exception using
        errcode = '23503',
        message = format(
          '%s must identify a member of family %s',
          member_column,
          family_uuid
        );
    end if;
  end loop;
  return new;
end
$$;

create or replace function
  private.capture_child_progress_evidence_adult_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.adult_display_name_snapshot := null;
  if new.member_user_id is null then return new; end if;

  select left(nullif(btrim(member.display_name), ''), 120)
  into new.adult_display_name_snapshot
  from public.family_members member
  where member.family_id = new.family_id
    and member.user_id = new.member_user_id;

  return new;
end
$$;

create or replace function private.validate_child_progress_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.supersedes_id is not null then
    if new.supersedes_id = new.id then
      raise exception using
        errcode = '23514',
        message = 'Evidence cannot supersede itself';
    end if;
    if not exists (
      select 1
      from public.child_progress_evidence superseded
      where superseded.id = new.supersedes_id
        and superseded.child_id = new.child_id
        and superseded.family_id = new.family_id
        and superseded.item_id = new.item_id
    )
    then
      raise exception using
        errcode = '23514',
        message = 'Superseded evidence must match child, family, and item';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and new.item_id is distinct from old.item_id
    and exists (
      select 1
      from public.child_progress_evidence dependent
      where dependent.supersedes_id = old.id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Evidence with superseding rows cannot change item';
  end if;
  return new;
end
$$;

create or replace function private.validate_progress_check_in_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_evidence
    and not exists (
      select 1
      from public.child_progress_evidence evidence
      where evidence.id = new.evidence_id
        and evidence.child_id = new.child_id
        and evidence.family_id = new.family_id
        and evidence.item_id = new.item_id
        and evidence.answer = new.answer
        and evidence.check_in_id = new.check_in_id
        and evidence.member_user_id is not distinct from new.member_user_id
        and evidence.channel = new.channel
        and evidence.message_id = new.inbound_message_id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Response evidence must match child, family, item, answer, check-in, and member';
  end if;
  return new;
end
$$;

create or replace function private.validate_child_progress_conflict()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence_a_answer text;
  evidence_a_member uuid;
  evidence_b_answer text;
  evidence_b_member uuid;
begin
  select evidence.answer, evidence.member_user_id
  into evidence_a_answer, evidence_a_member
  from public.child_progress_evidence evidence
  where evidence.id = new.evidence_id_a
    and evidence.child_id = new.child_id
    and evidence.family_id = new.family_id
    and evidence.item_id = new.item_id;
  if not found then
    raise exception using
      errcode = '23514',
      message = 'Conflict evidence A must match child, family, and item';
  end if;

  select evidence.answer, evidence.member_user_id
  into evidence_b_answer, evidence_b_member
  from public.child_progress_evidence evidence
  where evidence.id = new.evidence_id_b
    and evidence.child_id = new.child_id
    and evidence.family_id = new.family_id
    and evidence.item_id = new.item_id;
  if not found then
    raise exception using
      errcode = '23514',
      message = 'Conflict evidence B must match child, family, and item';
  end if;

  if evidence_a_answer = evidence_b_answer then
    raise exception using
      errcode = '23514',
      message = 'Conflict evidence must contain different answers';
  end if;
  if (
      (
        new.state = 'open'
      )
      or (
        tg_op = 'INSERT'
        and new.state = 'resolved'
      )
    )
    and (
      evidence_a_member is null
      or evidence_b_member is null
      or evidence_a_member = evidence_b_member
    )
  then
    raise exception using
      errcode = '23514',
      message = 'New conflict evidence requires two distinct attributed adults';
  end if;

  if (
      (
        tg_op = 'INSERT'
        and new.state = 'resolved'
      )
      or (
        tg_op = 'UPDATE'
        and old.state = 'open'
        and new.state = 'resolved'
      )
    )
    and new.resolved_by_member_user_id is null
  then
    raise exception using
      errcode = '23514',
      message = 'Newly resolved conflict requires an attributed resolver';
  end if;

  if new.state = 'resolved'
    and not exists (
      select 1
      from public.child_progress_evidence evidence
      where evidence.id = new.resolved_evidence_id
        and evidence.child_id = new.child_id
        and evidence.family_id = new.family_id
        and evidence.item_id = new.item_id
        and evidence.answer = new.resolved_answer
        and evidence.id in (new.evidence_id_a, new.evidence_id_b)
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Resolved evidence must be evidence A or B and match child, family, item, and answer';
  end if;
  return new;
end
$$;

create or replace function private.validate_child_progress_operation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(new.result) <> 'object'
    or new.result ->> 'status' is distinct from new.status
  then
    raise exception using
      errcode = '23514',
      message = 'Operation result status must match the receipt status';
  end if;
  if new.status = 'pending'
    and (
      cardinality(new.evidence_ids) <> 0
      or cardinality(new.affected_item_ids) <> 0
      or cardinality(new.conflict_ids) <> 0
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Pending operation receipts cannot reference results';
  end if;
  if new.status in (
    'recorded',
    'conflict_open',
    'conflict_resolved',
    'undone'
  )
    and cardinality(new.evidence_ids) = 0
  then
    raise exception using
      errcode = '23514',
      message = 'Recorded operation receipts require evidence';
  end if;
  if new.status = 'conflict_resolved'
    and (
      cardinality(new.evidence_ids) <> 1
      or cardinality(new.conflict_ids) <> 1
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Conflict resolution receipts require one evidence row and one conflict';
  end if;
  if exists (
    select 1
    from unnest(new.evidence_ids) as listed(evidence_id)
    where listed.evidence_id is null
      or not exists (
        select 1
        from public.child_progress_evidence evidence
        where evidence.id = listed.evidence_id
          and evidence.child_id = new.child_id
          and evidence.family_id = new.family_id
      )
  )
  then
    raise exception using
      errcode = '23514',
      message = 'Operation evidence must belong to the same child and family';
  end if;
  if exists (
    select 1
    from unnest(new.conflict_ids) as listed(conflict_id)
    where listed.conflict_id is null
      or not exists (
        select 1
        from public.child_progress_conflicts conflict
        where conflict.id = listed.conflict_id
          and conflict.child_id = new.child_id
          and conflict.family_id = new.family_id
      )
  )
  then
    raise exception using
      errcode = '23514',
      message = 'Operation conflicts must belong to the same child and family';
  end if;
  return new;
end
$$;

create or replace function private.validate_child_progress_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from unnest(new.evidence_ids) as listed(evidence_id)
    where listed.evidence_id is null
      or not exists (
        select 1
        from public.child_progress_evidence evidence
        where evidence.id = listed.evidence_id
          and evidence.child_id = new.child_id
          and evidence.family_id = new.family_id
      )
  )
  then
    raise exception using
      errcode = '23514',
      message = 'Snapshot evidence must belong to the same child and family';
  end if;
  return new;
end
$$;

revoke all on function private.bump_child_progress_revision(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.bump_child_progress_row_revision()
  from public, anon, authenticated;
revoke all on function private.bump_child_answer_progress_revision()
  from public, anon, authenticated;
revoke all on function private.bump_child_identity_progress_revision()
  from public, anon, authenticated;
revoke all on function private.bump_family_progress_revisions()
  from public, anon, authenticated;
revoke all on function private.bump_member_progress_revisions()
  from public, anon, authenticated;
revoke all on function private.pause_check_ins_for_removed_member()
  from public, anon, authenticated;
revoke all on function private.validate_progress_check_in_transition()
  from public, anon, authenticated;
revoke all on function private.validate_child_progress_family_members()
  from public, anon, authenticated;
revoke all on function
  private.capture_child_progress_evidence_adult_name()
  from public, anon, authenticated;
revoke all on function private.validate_child_progress_evidence()
  from public, anon, authenticated;
revoke all on function private.validate_progress_check_in_response()
  from public, anon, authenticated;
revoke all on function private.validate_child_progress_conflict()
  from public, anon, authenticated;
revoke all on function private.validate_child_progress_operation()
  from public, anon, authenticated;
revoke all on function private.validate_child_progress_snapshot()
  from public, anon, authenticated;

create trigger child_progress_evidence_capture_adult_name
  before insert on public.child_progress_evidence
  for each row execute function
    private.capture_child_progress_evidence_adult_name();

create trigger child_progress_evidence_revision_bump
  after insert or update or delete on public.child_progress_evidence
  for each row execute function
    private.bump_child_progress_row_revision();

create trigger child_progress_conflicts_revision_bump
  after insert or update or delete on public.child_progress_conflicts
  for each row execute function
    private.bump_child_progress_row_revision();

create trigger progress_check_in_responses_revision_bump
  after insert or delete or update of revision, item_id, answer, created_at
  on public.progress_check_in_responses
  for each row execute function
    private.bump_child_progress_row_revision();

-- This trigger only invalidates the live projection. It never creates
-- evidence. Application writers take the shared reconciliation advisory
-- lock before their child_answers statement, preserving global lock order.
create trigger child_answers_progress_revision_bump
  after insert or update or delete on public.child_answers
  for each row execute function
    private.bump_child_answer_progress_revision();

create trigger children_progress_identity_revision_bump
  after update of name, birth_month, family_id on public.children
  for each row execute function
    private.bump_child_identity_progress_revision();

create trigger families_progress_time_zone_revision_bump
  after update of time_zone on public.families
  for each row execute function
    private.bump_family_progress_revisions();

create trigger progress_check_ins_transition_check
  before insert or update on public.progress_check_ins
  for each row execute function
    private.validate_progress_check_in_transition();

create trigger family_members_pause_check_ins_before_removal
  before delete or update of family_id, user_id
  on public.family_members
  for each row execute function
    private.pause_check_ins_for_removed_member();

create trigger family_members_progress_name_revision_bump
  after update of display_name on public.family_members
  for each row execute function
    private.bump_member_progress_revisions();

create trigger family_members_progress_delete_revision_bump
  after delete on public.family_members
  for each row execute function
    private.bump_member_progress_revisions();

create constraint trigger child_progress_evidence_family_members_check
  after insert or update on public.child_progress_evidence
  deferrable initially deferred
  for each row execute function
    private.validate_child_progress_family_members('member_user_id');

create constraint trigger child_progress_evidence_shape_check
  after insert or update on public.child_progress_evidence
  deferrable initially deferred
  for each row execute function
    private.validate_child_progress_evidence();

create constraint trigger progress_check_ins_family_members_check
  after insert or update on public.progress_check_ins
  deferrable initially deferred
  for each row execute function
    private.validate_child_progress_family_members(
      'active_member_user_id',
      'prompt_recipient_member_user_id'
    );

create constraint trigger progress_check_in_responses_family_members_check
  after insert or update on public.progress_check_in_responses
  deferrable initially deferred
  for each row execute function
    private.validate_child_progress_family_members('member_user_id');

create constraint trigger child_progress_conflicts_family_members_check
  after insert or update on public.child_progress_conflicts
  deferrable initially deferred
  for each row execute function
    private.validate_child_progress_family_members(
      'resolved_by_member_user_id'
    );

create constraint trigger progress_check_in_responses_shape_check
  after insert or update on public.progress_check_in_responses
  deferrable initially deferred
  for each row execute function
    private.validate_progress_check_in_response();

create constraint trigger child_progress_conflicts_shape_check
  after insert or update on public.child_progress_conflicts
  deferrable initially deferred
  for each row execute function
    private.validate_child_progress_conflict();

create constraint trigger child_progress_operations_shape_check
  after insert or update on public.child_progress_operations
  deferrable initially deferred
  for each row execute function
    private.validate_child_progress_operation();

create constraint trigger child_progress_snapshots_shape_check
  after insert or update on public.child_progress_snapshots
  deferrable initially deferred
  for each row execute function
    private.validate_child_progress_snapshot();

alter table public.child_progress_evidence enable row level security;
alter table public.child_progress_operations enable row level security;
alter table public.child_progress_revisions enable row level security;
alter table public.child_progress_live enable row level security;
alter table public.progress_check_ins enable row level security;
alter table public.progress_check_in_responses enable row level security;
alter table public.child_progress_conflicts enable row level security;
alter table public.child_progress_snapshots enable row level security;
alter table public.map_walk_prompts enable row level security;

create policy "members read child progress evidence"
  on public.child_progress_evidence
  for select
  to authenticated
  using (public.is_child_family_member(child_id));

create policy "members read child progress operations"
  on public.child_progress_operations
  for select
  to authenticated
  using (public.is_child_family_member(child_id));

create policy "members read child progress revisions"
  on public.child_progress_revisions
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
  using (public.is_child_family_member(child_id));

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

-- Mutations are denied both by missing policies and by table privileges.
-- Anonymous callers receive no table grant.
revoke all on table public.child_progress_evidence
  from public, anon, authenticated;
revoke all on table public.child_progress_operations
  from public, anon, authenticated;
revoke all on table public.child_progress_revisions
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
revoke all on table public.map_walk_prompts
  from public, anon, authenticated;

grant select on table public.child_progress_evidence to authenticated;
grant select on table public.child_progress_operations to authenticated;
grant select on table public.child_progress_revisions to authenticated;
grant select on table public.child_progress_live to authenticated;
grant select on table public.progress_check_ins to authenticated;
grant select on table public.progress_check_in_responses to authenticated;
grant select on table public.child_progress_conflicts to authenticated;
grant select on table public.child_progress_snapshots to authenticated;

comment on table public.child_progress_evidence is
  'Append-only ChildProgress evidence. Writes use server-only mapDb paths. child_answers remains a compatibility projection.';
comment on table public.child_progress_operations is
  'Durable server-only ChildProgress idempotency receipts. Authenticated family members have scoped read access only.';
comment on table public.child_progress_revisions is
  'Canonical child progress source revision. Writers lock this row before source reads; source-table triggers bump it; live writes never do.';
comment on table public.child_progress_live is
  'Current ChildProgress projection. Writes use server-only mapDb paths. child_reports remains a compatibility projection.';
comment on table public.progress_check_ins is
  'Durable ChildProgress check-in state. Authenticated Data API callers have family-scoped read access only.';
comment on table public.progress_check_in_responses is
  'Immutable check-in answers with transaction-completed evidence and replay metadata. Writes use server-only mapDb paths and composite keys enforce child and family scope.';
comment on table public.child_progress_conflicts is
  'ChildProgress evidence conflicts. Writes and resolutions use server-only mapDb paths.';
comment on table public.child_progress_snapshots is
  'Internal ChildProgress projection history, including one start baseline per check-in. Writes use server-only mapDb paths.';
comment on table public.map_walk_prompts is
  'Server-only graph-walk prompt receipts. Browser answers must consume the exact unexpired prompt through mapDb.';

-- child_answers is now a server-maintained compatibility projection. Repository
-- review found only caller-token SELECTs; every mutation uses direct mapDb SQL.
drop policy if exists "members add child answers"
  on public.child_answers;
drop policy if exists "members update child answers"
  on public.child_answers;
drop policy if exists "members delete child answers"
  on public.child_answers;
revoke insert, update, delete on table public.child_answers
  from public, anon, authenticated;
grant select on table public.child_answers to authenticated;
comment on table public.child_answers is
  'Compatibility projection readable by authenticated family members. Mutations use server-only mapDb paths. Task 9 moves every remaining writer behind ChildProgress before rollout.';

create or replace function private.reconcile_child_answers_to_progress()
returns table(inserted_count bigint, superseded_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  reconciliation_at timestamptz := clock_timestamp();
  inserted_rows bigint := 0;
  superseded_rows bigint := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    private.child_progress_reconciliation_lock_key()
  );
  lock table public.child_answers in share row exclusive mode;

  insert into public.child_progress_evidence (
    child_id,
    family_id,
    item_id,
    answer,
    source,
    supersedes_id,
    observed_at,
    idempotency_key,
    created_at
  )
  select
    answer.child_id,
    child.family_id,
    answer.question_id,
    answer.answer,
    private.normalize_child_progress_source(answer.source),
    previous.id,
    answer.answered_at,
    'legacy-reconcile:' || md5(
      answer.child_id::text
        || '|' || answer.question_id
        || '|' || answer.answer
        || '|' || private.normalize_child_progress_source(answer.source)
        || '|' || extract(epoch from answer.answered_at)::text
    ),
    answer.answered_at
  from public.child_answers answer
  join public.children child on child.id = answer.child_id
  left join lateral (
    select evidence.id
    from public.child_progress_evidence evidence
    where evidence.child_id = answer.child_id
      and evidence.family_id = child.family_id
      and evidence.item_id = answer.question_id
      and evidence.superseded_at is null
      and (
        evidence.idempotency_key like 'legacy:%'
        or evidence.idempotency_key like 'legacy-reconcile:%'
      )
    order by evidence.observed_at desc, evidence.created_at desc,
             evidence.id desc
    limit 1
  ) previous on true
  where answer.answer in ('easily', 'getting_there', 'not_yet')
    and not exists (
      select 1
      from public.child_progress_evidence exact_evidence
      where exact_evidence.child_id = answer.child_id
        and exact_evidence.family_id = child.family_id
        and exact_evidence.item_id = answer.question_id
        and exact_evidence.answer = answer.answer
        and exact_evidence.source =
          private.normalize_child_progress_source(answer.source)
        and exact_evidence.observed_at = answer.answered_at
        and exact_evidence.superseded_at is null
    )
  on conflict (child_id, family_id, idempotency_key) do nothing;
  get diagnostics inserted_rows = row_count;

  update public.child_progress_evidence evidence
  set superseded_at = reconciliation_at
  where evidence.superseded_at is null
    and (
      evidence.idempotency_key like 'legacy:%'
      or evidence.idempotency_key like 'legacy-reconcile:%'
    )
    and not exists (
      select 1
      from public.child_progress_conflicts conflict
      where conflict.child_id = evidence.child_id
        and conflict.family_id = evidence.family_id
        and conflict.state = 'open'
        and evidence.id in (
          conflict.evidence_id_a,
          conflict.evidence_id_b
        )
    )
    and not exists (
      select 1
      from public.child_answers answer
      join public.children child on child.id = answer.child_id
      where answer.child_id = evidence.child_id
        and child.family_id = evidence.family_id
        and answer.question_id = evidence.item_id
        and answer.answer in ('easily', 'getting_there', 'not_yet')
        and answer.answer = evidence.answer
        and evidence.source =
          private.normalize_child_progress_source(answer.source)
        and evidence.observed_at = answer.answered_at
    );
  get diagnostics superseded_rows = row_count;

  return query select inserted_rows, superseded_rows;
end
$$;

revoke all on function private.reconcile_child_answers_to_progress()
  from public, anon, authenticated;

-- Initial migration backfill. Rollout runs this function once more after
-- Task 9 writers are deployed, immediately before the live-progress flag.
select * from private.reconcile_child_answers_to_progress();
