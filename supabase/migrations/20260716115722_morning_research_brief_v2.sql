-- Morning research brief v2 durable delivery truth.
--
-- Preparation is server-only staging keyed to one task run. Delivered
-- knowledge use and parent feedback are separate records so source novelty,
-- delivery, and explicit feedback do not collapse into one mutable row.

alter table public.homa_task_runs
  add column delivery_version text not null default 'legacy'
  constraint homa_task_runs_delivery_version_check
    check (delivery_version in ('legacy', 'research_brief_v2'));

alter table public.homa_task_runs
  add constraint homa_task_runs_id_family_key unique (id, family_id);

create table public.research_brief_preparations (
  task_run_id uuid primary key,
  family_id uuid not null
    references public.families (id) on delete cascade,
  child_id uuid not null,
  knowledge_bank_id uuid not null
    references public.knowledge_bank (id),
  observation_id uuid
    references public.child_observations (id) on delete set null,
  draft text not null,
  draft_hash text not null,
  source_snapshot jsonb not null,
  prepared_at timestamptz not null,
  delivered_at timestamptz,
  constraint research_brief_preparations_task_run_family_fkey
    foreign key (task_run_id, family_id)
    references public.homa_task_runs (id, family_id)
    match full
    on delete cascade,
  constraint research_brief_preparations_child_family_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
    deferrable initially deferred
);

create table public.family_knowledge_use (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families (id) on delete cascade,
  knowledge_bank_id uuid not null
    references public.knowledge_bank (id),
  task_run_id uuid not null,
  used_at timestamptz not null,
  constraint family_knowledge_use_task_run_family_fkey
    foreign key (task_run_id, family_id)
    references public.homa_task_runs (id, family_id)
    match full
    on delete cascade,
  unique (family_id, knowledge_bank_id, task_run_id)
);

create table public.research_brief_feedback (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families (id) on delete cascade,
  task_run_id uuid not null,
  member_user_id uuid not null
    references auth.users (id) on delete cascade,
  signal text not null
    check (signal in ('helpful', 'not_for_us')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint research_brief_feedback_task_run_family_fkey
    foreign key (task_run_id, family_id)
    references public.homa_task_runs (id, family_id)
    match full
    on delete cascade,
  constraint research_brief_feedback_member_family_fkey
    foreign key (family_id, member_user_id)
    references public.family_members (family_id, user_id)
    match full
    on update cascade
    on delete cascade,
  unique (task_run_id, member_user_id)
);

alter table public.conversation_open_loops
  add column if not exists resolved_outcome text;
alter table public.conversation_open_loops
  add constraint conversation_open_loops_resolved_outcome_check
  check (
    resolved_outcome is null
    or resolved_outcome in ('accepted', 'declined', 'answered')
  );

alter table public.conversation_deliveries
  add column provider_submission_id text
  constraint conversation_deliveries_provider_submission_id_check
    check (
      provider_submission_id is null
      or btrim(provider_submission_id) <> ''
    );

create unique index if not exists
  conversation_deliveries_provider_submission_id_idx
  on public.conversation_deliveries (provider_submission_id)
  where provider_submission_id is not null;

create index if not exists conversation_open_loops_resolved_range_idx
  on public.conversation_open_loops (resolved_at, delivery_id)
  include (resolved_outcome)
  where state = 'resolved' and resolved_at is not null;

create index if not exists conversation_deliveries_family_episode_sent_idx
  on public.conversation_deliveries
    (family_id, episode_id, sent_at desc)
  include (task_run_id)
  where status = 'sent';

create index if not exists conversation_deliveries_sent_at_task_idx
  on public.conversation_deliveries (sent_at, task_run_id)
  include (id, family_id)
  where status = 'sent' and sent_at is not null;

create index if not exists conversation_messages_unlinked_user_episode_idx
  on public.conversation_messages
    (family_id, episode_id, created_at)
  where role = 'user' and replied_delivery_id is null;

create index if not exists conversation_messages_unlinked_user_created_at_idx
  on public.conversation_messages (created_at, family_id, episode_id)
  include (id)
  where role = 'user' and replied_delivery_id is null;

alter table public.research_brief_preparations enable row level security;
alter table public.family_knowledge_use enable row level security;
alter table public.research_brief_feedback enable row level security;

revoke all on table public.research_brief_preparations
  from public, anon, authenticated;
revoke all on table public.family_knowledge_use
  from public, anon, authenticated;
revoke all on table public.research_brief_feedback
  from public, anon, authenticated;
grant select on table public.research_brief_feedback to authenticated;

create policy "members read their research brief feedback"
  on public.research_brief_feedback
  for select
  to authenticated
  using (public.is_family_member(family_id));
