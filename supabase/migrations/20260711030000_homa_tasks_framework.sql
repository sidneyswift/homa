-- Migration #49: the task framework (plans/2026-07-10-homa-tasks-and-nightly-research.md,
-- HT-1; founder decisions D-ht-1..D-ht-5, 2026-07-10 evening).
--
-- 1. agent_schedules grows from "the journal row" into the family task
--    store: new kinds (morning_brief, custom), per-row schedule fields
--    (local_hour, weekdays), delivery preference, and parent-visible
--    label/prompt for custom tasks. RLS changes from deny-all to
--    SELECT-only for the family's own members (the Homa's tasks tab
--    reads it); every write still goes through the server connection.
--    The table is empty in prod today (journal seeding is gated by
--    JOURNAL_PROMPT_ENABLED, never flipped), so column defaults are free.
--
-- 2. homa_task_runs: one row per proactive run. It is four things at
--    once: the tab's history feed, the at-least-once outbox (unique
--    partial index on schedule_id + scheduled_for), the health record a
--    future fleet-doctor reads (M4-01), and the audit trail for fleet
--    research (family_id null; those rows are never family-visible).
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

alter table public.agent_schedules
  drop constraint if exists agent_schedules_kind_check;
alter table public.agent_schedules
  add constraint agent_schedules_kind_check
  check (kind in ('journal_prompt', 'morning_brief', 'custom'));

alter table public.agent_schedules
  add column if not exists local_hour smallint not null default 20
    check (local_hour between 0 and 23),
  add column if not exists weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  add column if not exists delivery_pref text not null default 'text'
    check (delivery_pref in ('text', 'email', 'none')),
  add column if not exists label text
    check (label is null or char_length(label) between 1 and 60),
  add column if not exists prompt text
    check (prompt is null or char_length(prompt) between 1 and 1000),
  add column if not exists created_by text not null default 'system'
    check (created_by in ('system', 'parent', 'homa')),
  -- The parent's own switch (the tab toggle). Kept separate from
  -- `enabled` (system eligibility hygiene) so hourly seeding can never
  -- silently undo a choice the parent made.
  add column if not exists paused_at timestamptz;

alter table public.agent_schedules
  drop constraint if exists agent_schedules_weekdays_valid;
alter table public.agent_schedules
  add constraint agent_schedules_weekdays_valid
  check (weekdays <@ '{0,1,2,3,4,5,6}'::smallint[] and array_length(weekdays, 1) >= 1);

-- The (family_id, kind) unique from migration #39 held one row per
-- built-in kind. Custom tasks need many rows per family, so the unique
-- moves to a partial index over the built-ins only.
alter table public.agent_schedules
  drop constraint if exists agent_schedules_family_id_kind_key;
create unique index if not exists agent_schedules_builtin_unique_idx
  on public.agent_schedules (family_id, kind)
  where kind in ('journal_prompt', 'morning_brief');

-- Members see their own family's task rows (the tab); nobody writes
-- through the Data API (no insert/update/delete policies exist).
create policy "members read their agent schedules"
  on public.agent_schedules
  for select
  to authenticated
  using (public.is_family_member(family_id));

create table if not exists public.homa_task_runs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete cascade,
  schedule_id uuid references public.agent_schedules (id) on delete set null,
  kind text not null
    check (kind in ('journal_prompt', 'morning_brief', 'custom', 'fleet_research')),
  status text not null default 'running'
    check (status in ('running', 'done', 'failed', 'skipped')),
  -- The family-local calendar day this run served; with schedule_id it
  -- forms the outbox key that absorbs at-least-once redelivery.
  scheduled_for date,
  title text not null check (char_length(title) between 1 and 120),
  summary text check (summary is null or char_length(summary) <= 4000),
  artifacts jsonb not null default '[]',
  delivered_channel text
    check (delivered_channel in ('sms', 'email', 'none')),
  error text,
  session_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- One live-or-finished run per schedule per local day. Failed runs fall
-- out of the index so the next tick may retry the same day.
create unique index if not exists homa_task_runs_outbox_idx
  on public.homa_task_runs (schedule_id, scheduled_for)
  where schedule_id is not null
    and scheduled_for is not null
    and status in ('running', 'done', 'skipped');

create index if not exists homa_task_runs_family_idx
  on public.homa_task_runs (family_id, created_at desc);

alter table public.homa_task_runs enable row level security;

-- Members read their own family's runs; fleet rows (family_id null)
-- match no membership and stay server-only. No write policies exist.
create policy "members read their task runs"
  on public.homa_task_runs
  for select
  to authenticated
  using (family_id is not null and public.is_family_member(family_id));
