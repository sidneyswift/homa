-- Durable, parent-visible working plans (gh#175).
--
-- Month-plan previews used to live only in a session-bound signed token. A
-- daily Eve rotation therefore turned unfinished planning work back into chat
-- archaeology. This table keeps the verified working object while preserving
-- the existing approval boundary: a draft is not a Planner write.

create table if not exists public.working_plans (
  id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('month_plan')),
  title text not null check (char_length(title) between 1 and 160),
  status text not null default 'draft'
    check (status in ('draft', 'finalized', 'archived')),
  source_session_id text,
  source_entries jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_entries) = 'array')
    check (char_length(source_entries::text) <= 20000),
  current_revision smallint not null
    check (current_revision between 1 and 100),
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object')
    check (char_length(payload::text) <= 250000),
  artifact_links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(artifact_links) = 'array')
    check (char_length(artifact_links::text) <= 20000),
  effect_receipts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(effect_receipts) = 'array')
    check (char_length(effect_receipts::text) <= 20000),
  finalized_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id),
  check (finalized_at is null or status = 'finalized'),
  check (archived_at is null or status = 'archived')
);

create index if not exists working_plans_family_status_idx
  on public.working_plans (family_id, status, updated_at desc);

alter table public.working_plans enable row level security;

create policy "members read their working plans"
  on public.working_plans
  for select
  to authenticated
  using (public.is_family_member(family_id));

-- Deliberately no browser write policy. Agent tools re-derive family_id from
-- authenticated context and write through the server connection.
revoke insert, update, delete on public.working_plans from authenticated;
