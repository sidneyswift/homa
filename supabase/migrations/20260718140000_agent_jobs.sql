-- Stage 2 of the agreed agent-jobs build
-- (docs/homa-planning/plans/2026-07-18-curriculum-studio-tweakable-plan.html,
-- reviewed by the 2026-07-18 expert council). A GENERAL finite,
-- resumable, cancellable multi-stage job primitive that any fleet skill
-- can use, not a curriculum-only feature. Curriculum-studio is the first
-- consumer; the schema knows nothing about weeks or volumes (that lives
-- in the skill-owned plan/payload jsonb, validated by JOB_CONTRACTS).
--
-- Supersedes the curriculum-only draft (20260718120000_curriculum_jobs.sql,
-- never applied, removed): same shape, generalized to agent_jobs and named
-- after the primitive.
--
-- Substrate decision (council): a NEW table set, not an extension of
-- agent_schedules (a pure recurrence engine) or homa_task_runs (a
-- one-row-per-send outbox with a 2-hour reaper). A finite job stays
-- "running" for hours across many stages and needs live progress, pause,
-- and mid-flight cancel; neither existing table was built for that.
--
-- Durable-state law (BUILD.md #2): these four tables are the ONLY source
-- of truth for a job's status, stage progress, artifacts, and timeline.
-- The Postgres claim-lease runner transports IDs and re-reads rows at
-- every stage boundary; nothing load-bearing lives in eve session state
-- (session_id is an audit pointer only).
--
-- Tenancy (BUILD.md #1): every table carries family_id and a members-read
-- SELECT policy scoped by is_family_member(family_id). There are NO
-- INSERT/UPDATE/DELETE policies: all writes go through the app's own
-- server connection (lib/jobs/store.ts, lib/map/db.ts), which re-derives
-- family_id from the authenticated caller and never from model input.
-- Composite foreign keys prove tenant coherence in Postgres itself.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

-- homa_task_runs.kind gains one additive value so a finished job's
-- completion summary can appear in the parent's existing /app/tasks
-- history feed, without teaching that table anything about stages.
alter table public.homa_task_runs
  drop constraint if exists homa_task_runs_kind_check;
alter table public.homa_task_runs
  add constraint homa_task_runs_kind_check
  check (kind in ('journal_prompt', 'morning_brief', 'custom', 'fleet_research', 'agent_job'));

-- materials.id is already globally unique (primary key); this additive
-- index lets agent_job_stage_artifacts prove in Postgres that a stage's
-- finished material belongs to the same family as the job, the same
-- composite-identity trick the ChildProgress tables use.
create unique index if not exists materials_family_identity_idx
  on public.materials (id, family_id);

-- ============================================================
-- agent_jobs: one row per finite build, the job-level state machine.
-- ============================================================
create table if not exists public.agent_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Null means the job is not tied to one child (a family-wide job); most
  -- carry a child_id. Composite FK below proves the child is this family's.
  child_id uuid references public.children (id) on delete set null,
  -- The adult who asked, for the audit trail. Never used for tenant
  -- scoping: reads and writes re-derive family_id from auth, not this.
  requested_by_user_id uuid references auth.users (id) on delete set null,
  -- The eve session that started the job. Audit pointer only; the job's
  -- truth lives in these tables, never in session/turn history.
  session_id text,
  -- Which fleet skill owns this job. Validated against the closed
  -- JOB_CONTRACTS key set at start_agent_job time; the generic infra
  -- never branches on it, the skill's own reading of plan/payload does.
  skill text not null check (char_length(skill) between 2 and 60),
  title text not null check (char_length(title) between 1 and 160),
  -- The plan (scope and sequence). Shape is owned by the skill's zod
  -- contract, opaque to this table.
  plan jsonb not null default '{}'::jsonb
    check (char_length(plan::text) <= 40000),
  -- Bumped by the runner (in the same tx as a plan revision) when a
  -- parent amends a running job; pending stages are re-expanded from the
  -- revised plan, approved stages are never silently rebuilt.
  plan_revision smallint not null default 1 check (plan_revision >= 1),
  total_stages smallint not null check (total_stages between 1 and 200),
  current_stage smallint not null default 0
    check (current_stage between 0 and total_stages),
  status text not null default 'queued'
    check (status in (
      'queued', 'running', 'paused', 'awaiting_input',
      'completed', 'cancelled', 'failed'
    )),
  -- Derived one-liner for a quick status read ("Building week 5 of 36").
  -- The real timeline is agent_job_events.
  progress_note text check (progress_note is null or char_length(progress_note) <= 240),
  -- Verbatim-retry guard only, NOT the dedupe (the one-active-job index
  -- below is the dedupe). A retried identical start with the same key
  -- returns the existing job instead of spawning a second.
  start_idempotency_key text
    check (start_idempotency_key is null or char_length(start_idempotency_key) between 3 and 160),
  -- Cooperative cancellation: the cancel tool sets cancel_requested_at
  -- immediately (its honest result); the runner checks it between stages
  -- and only then sets cancelled_at and flips status to 'cancelled'.
  cancel_requested_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 240),
  cancelled_at timestamptz,
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 500),
  -- Completion delivery record, same shape as homa_task_runs' delivery
  -- columns. completion_task_run_id optionally links a homa_task_runs row
  -- (kind='agent_job') so the finished job shows up in /app/tasks history.
  delivered_channel text check (delivered_channel is null or delivered_channel in ('sms', 'email', 'none')),
  delivered_at timestamptz,
  delivery_summary text check (delivery_summary is null or char_length(delivery_summary) <= 4000),
  completion_task_run_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Status/timestamp coherence.
  check (cancel_reason is null or cancel_requested_at is not null),
  check (cancelled_at is null or cancel_requested_at is not null),
  check (cancelled_at is null or status = 'cancelled'),
  check (completed_at is null or status = 'completed'),
  check (failure_reason is null or status = 'failed'),
  check (delivered_at is null or status = 'completed'),
  -- Composite identity so child rows can prove tenant coherence against it.
  unique (id, family_id),
  -- child_id optional; MATCH SIMPLE skips this check when child_id is null.
  foreign key (child_id, family_id) references public.children (id, family_id),
  -- completion_task_run_id must belong to the SAME family. homa_task_runs
  -- .family_id is nullable (fleet rows); MATCH SIMPLE skips the check when
  -- completion_task_run_id is null, and requires a same-family run when set.
  foreign key (completion_task_run_id, family_id)
    references public.homa_task_runs (id, family_id)
);

create index if not exists agent_jobs_family_idx
  on public.agent_jobs (family_id, created_at desc);

-- Lets the runner and a "list active jobs" read find live jobs cheaply
-- without scanning finished ones.
create index if not exists agent_jobs_active_idx
  on public.agent_jobs (status, updated_at)
  where status in ('queued', 'running', 'paused', 'awaiting_input');

-- THE dedupe: at most one active job per family + skill + child. A null
-- child_id collapses to a sentinel so "one family-wide job of this skill"
-- is also enforced. start_agent_job returns the existing job on conflict.
create unique index if not exists agent_jobs_one_active_idx
  on public.agent_jobs (
    family_id, skill, coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status in ('queued', 'running', 'paused', 'awaiting_input');

-- Verbatim-retry guard: one job per family per idempotency key.
create unique index if not exists agent_jobs_start_idempotency_idx
  on public.agent_jobs (family_id, start_idempotency_key)
  where start_idempotency_key is not null;

alter table public.agent_jobs enable row level security;

create policy "members read their agent jobs"
  on public.agent_jobs
  for select
  to authenticated
  using (public.is_family_member(family_id));

-- ============================================================
-- agent_job_stages: one row per stage, the per-stage state machine.
-- ============================================================
create table if not exists public.agent_job_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.agent_jobs (id) on delete cascade,
  -- Denormalized on purpose so RLS and the isolation guard can scope this
  -- table directly, without a join, the same posture ChildProgress takes.
  family_id uuid not null references public.families (id) on delete cascade,
  stage_number smallint not null check (stage_number >= 1),
  status text not null default 'pending'
    check (status in (
      'pending', 'in_progress', 'ready_for_review',
      'approved', 'superseded', 'skipped', 'failed'
    )),
  title text check (title is null or char_length(title) <= 160),
  -- This stage's slice of the plan (a week's focus, a report section, a
  -- batch). Shape owned by the skill's stagePayload contract.
  payload jsonb not null default '{}'::jsonb
    check (char_length(payload::text) <= 8000),
  -- Per-stage metering, the billing truth for the credits/paywall rollup:
  -- typed, indexable, SUM-able columns the wall prices from, never parsed
  -- out of jsonb. Null until the stage runs.
  sandbox_cpu_seconds numeric check (sandbox_cpu_seconds is null or sandbox_cpu_seconds >= 0),
  page_fetch_count smallint check (page_fetch_count is null or page_fetch_count >= 0),
  model_tokens integer check (model_tokens is null or model_tokens >= 0),
  reviewed_at timestamptz,
  error text check (error is null or char_length(error) <= 500),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per stage per job; the runner upserts stage N, making a
  -- retried stage idempotent.
  unique (job_id, stage_number),
  check (completed_at is null or status in ('approved', 'skipped')),
  check (reviewed_at is null or status in ('ready_for_review', 'approved', 'superseded', 'skipped')),
  -- Composite FK proves the stage's family matches its parent job's family.
  foreign key (job_id, family_id) references public.agent_jobs (id, family_id)
);

create index if not exists agent_job_stages_job_idx
  on public.agent_job_stages (job_id, stage_number);
create index if not exists agent_job_stages_family_idx
  on public.agent_job_stages (family_id, created_at desc);
-- The runner's claim predicate: the next runnable stage of a runnable job.
create index if not exists agent_job_stages_runnable_idx
  on public.agent_job_stages (job_id, stage_number)
  where status in ('pending', 'failed');

alter table public.agent_job_stages enable row level security;

create policy "members read their agent job stages"
  on public.agent_job_stages
  for select
  to authenticated
  using (public.is_family_member(family_id));

-- ============================================================
-- agent_job_stage_artifacts: what a stage produced. A side table (not a
-- material_id column) so a stage can hold many artifacts, each kind keeps
-- a provable composite FK, and a new artifact kind later is one additive
-- nullable column plus one CHECK value, never a history rewrite.
-- ============================================================
create table if not exists public.agent_job_stage_artifacts (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.agent_job_stages (id) on delete cascade,
  job_id uuid not null,
  family_id uuid not null references public.families (id) on delete cascade,
  -- Widens additively per artifact kind. curriculum-studio writes
  -- 'material' rows; a future report skill adds 'report' here plus one
  -- nullable id column below.
  kind text not null check (kind in ('material')),
  material_id uuid,
  created_at timestamptz not null default now(),
  -- Exactly the id column for the declared kind is set.
  check ((kind = 'material') = (material_id is not null)),
  foreign key (job_id, family_id) references public.agent_jobs (id, family_id),
  foreign key (material_id, family_id) references public.materials (id, family_id)
);

create index if not exists agent_job_stage_artifacts_stage_idx
  on public.agent_job_stage_artifacts (stage_id);
create index if not exists agent_job_stage_artifacts_family_idx
  on public.agent_job_stage_artifacts (family_id, created_at desc);

alter table public.agent_job_stage_artifacts enable row level security;

create policy "members read their agent job stage artifacts"
  on public.agent_job_stage_artifacts
  for select
  to authenticated
  using (public.is_family_member(family_id));

-- ============================================================
-- agent_job_events: the parent-visible timeline and the runner's audit
-- trail. Progress UI, the morning brief, ETAs, and actor attribution all
-- read THIS, never progress_note. Runner-written; content-free of raw
-- parent quotes (payload carries structured, non-PII detail).
-- ============================================================
create table if not exists public.agent_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  family_id uuid not null references public.families (id) on delete cascade,
  stage_number smallint,
  kind text not null
    check (kind in (
      'stage_started', 'stage_completed', 'milestone',
      'steering_applied', 'error', 'eta_updated'
    )),
  -- Which adult caused this (an approval, a revision). Null for
  -- runner-internal events.
  actor_user_id uuid references auth.users (id) on delete set null,
  payload jsonb not null default '{}'::jsonb
    check (char_length(payload::text) <= 4000),
  created_at timestamptz not null default now(),
  foreign key (job_id, family_id) references public.agent_jobs (id, family_id)
);

create index if not exists agent_job_events_job_idx
  on public.agent_job_events (job_id, created_at desc);
create index if not exists agent_job_events_family_idx
  on public.agent_job_events (family_id, created_at desc);

alter table public.agent_job_events enable row level security;

create policy "members read their agent job events"
  on public.agent_job_events
  for select
  to authenticated
  using (public.is_family_member(family_id));
