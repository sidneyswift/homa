-- Child observations (plan 2026-07-13-observation-ledger.md, OBS-1).
-- Founder ruling 2026-07-13: parent input about a child's ability is
-- never wasted. When the journal matcher cannot score a parent's
-- report (no_match, activity_only, ambiguous), the server keeps the
-- moment here, inside the same transaction as the operation receipt,
-- so durability never depends on model discretion. Scored evidence
-- stays in child_progress_evidence; scores never move from this table.

create table public.child_observations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null,
  family_id uuid not null,
  member_user_id uuid references auth.users (id) on delete set null,
  quote text not null
    check (char_length(quote) between 1 and 8000),
  channel text not null
    check (channel in ('web', 'sms', 'email')),
  message_id uuid,
  provider_message_id text
    check (
      provider_message_id is null
      or btrim(provider_message_id) <> ''
    ),
  classification text not null
    check (
      classification in ('no_match', 'activity_only', 'ambiguous')
    ),
  candidates jsonb not null default '[]'::jsonb,
  subject_hints text[] not null default '{}',
  status text not null default 'new'
    check (status in ('new', 'used')),
  used_task_run_id uuid,
  used_at timestamptz,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint child_observations_used_shape
    check (
      (status = 'new' and used_at is null)
      or (status = 'used' and used_at is not null)
    ),
  constraint child_observations_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred,
  constraint child_observations_message_fkey
    foreign key (message_id, family_id)
    references public.conversation_messages (id, family_id)
    on update cascade
    on delete no action
    deferrable initially deferred
);

create index child_observations_reinforcement_idx
  on public.child_observations
  (family_id, child_id, status, created_at desc);

alter table public.child_observations enable row level security;

create policy "members read child observations"
  on public.child_observations
  for select
  to authenticated
  using (public.is_child_family_member(child_id));

-- Mutations are denied both by missing policies and by table
-- privileges; writes use the guarded server path only.
revoke all on table public.child_observations
  from public, anon, authenticated;
grant select on table public.child_observations to authenticated;

comment on table public.child_observations is
  'Unscored parent reports about a child''s abilities, captured server-side on every journal call the matcher cannot score. Feeds the weekly reinforcement loop; never moves scores.';
