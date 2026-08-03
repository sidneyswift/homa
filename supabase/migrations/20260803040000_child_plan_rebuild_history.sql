-- A plan rebuild changes the meaning of positional progress keys. Preserve the
-- complete previous version before replacement so unmatched completion is
-- recoverable and never has to be attached to different work.

create table public.child_plan_rebuild_history (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  subject_id text not null,
  plan_id uuid not null,
  plan_revision bigint not null check (plan_revision > 0),
  progress_revision bigint not null check (progress_revision >= 0),
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  progress jsonb not null check (jsonb_typeof(progress) = 'object'),
  remapped_progress jsonb not null
    check (jsonb_typeof(remapped_progress) = 'object'),
  source_links jsonb not null check (jsonb_typeof(source_links) = 'array'),
  scheduled_days jsonb not null check (jsonb_typeof(scheduled_days) = 'array'),
  archived_done_count integer not null check (archived_done_count >= 0),
  preserved_done_count integer not null
    check (
      preserved_done_count >= 0
      and preserved_done_count <= archived_done_count
    ),
  reason text not null check (reason in ('deep-dive-rebuild')),
  archived_at timestamptz not null default now()
);

create index child_plan_rebuild_history_child_subject_idx
  on public.child_plan_rebuild_history (
    child_id,
    subject_id,
    archived_at desc
  );

alter table public.child_plan_rebuild_history enable row level security;

create policy "members read child plan rebuild history"
  on public.child_plan_rebuild_history
  for select
  to authenticated
  using (public.is_child_family_member(child_id));

revoke all on table public.child_plan_rebuild_history from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.child_plan_rebuild_history from authenticated;
grant select on table public.child_plan_rebuild_history to authenticated;
grant all on table public.child_plan_rebuild_history to service_role;

comment on table public.child_plan_rebuild_history is
  'Immutable server-written snapshots of the plan and progress replaced by a rebuild.';
