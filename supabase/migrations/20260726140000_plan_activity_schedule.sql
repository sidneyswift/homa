-- plan_activity_schedule (issue #176, CG-03: calendar and homeschool
-- planner in 1). The actual M2-10 substrate the codebase has named as
-- an unbuilt milestone since the week board shipped
-- (apps/web/app/app/planner/day-grid.tsx's own comment, spread-week.ts):
-- a plan activity's weekday placement on /app/planner is presentation
-- only (spreadAcrossWeekdays is deterministic display math, never
-- persisted), and check-offs stay keyed "week.activityIndex"
-- (packages/core/src/map/schemas.ts PLAN_CHECK_KEY_RE), never by a real
-- calendar date. This table is the companion that gives one activity a
-- REAL persisted date, without touching FourWeekPlan/PlanWeek at all
-- (packages/core/src/map/plans.ts stays exactly as it is: those types
-- are shared with month-plan generation and the tokenized report pages,
-- and this ticket does not touch them).
--
-- One row per (child, subject plan, week, activity). Re-scheduling an
-- activity is an upsert on the same natural key, never a new row, so
-- moving "math week 2 activity 0" from Tuesday to Thursday updates the
-- one row instead of leaving a stale duplicate behind.
--
-- Known limitation, documented rather than fixed this pass (a real
-- edit_plan remove shifts every later activity's index down one,
-- lib/map/plan-edits.ts remapProgressAfterRemove): this table does not
-- yet cascade that shift, so a schedule row can point at a different,
-- still-in-bounds activity after a removal earlier in the same week, or
-- go out of bounds after the last one is removed. The calendar's own
-- read path (lib/calendar-view.ts) defends the out-of-bounds case by
-- re-reading the activity text at merge time and dropping anything that
-- no longer resolves, so a stale row can never render wrong text as if
-- it were real; the shifted-but-still-valid-index case is a real, rare
-- edge case left for a follow-up (teaching edit_plan's remove/replace
-- path to also touch this table in the same transaction).
--
-- RLS follows the same is_family_member + child-coherence pattern as
-- family_events (this same migration set) and hours_log (#37, plus its
-- 2026-07-26 update policy): select/insert/update/delete for
-- authenticated members, child_id always re-checked against this
-- family's own children.
--
-- NOT applied to production by this session on purpose; see the PR body.

create table if not exists public.plan_activity_schedule (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  -- A child_plans.subject_id value, e.g. "math" or "month" (the unified
  -- month plan, MONTH_PLAN_SUBJECT in packages/core/src/map/plans.ts).
  -- Kept as free text here (not a foreign key: child_plans has no unique
  -- id this table can cleanly reference alongside child_id) and
  -- re-validated against the family's real, currently-loaded plan at
  -- read and write time, never trusted blind.
  subject_id text not null check (char_length(subject_id) between 1 and 80),
  week smallint not null check (week between 1 and 4),
  activity_index smallint not null check (activity_index >= 0),
  scheduled_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, child_id, subject_id, week, activity_index)
);

create index if not exists plan_activity_schedule_family_date_idx
  on public.plan_activity_schedule (family_id, scheduled_date);

alter table public.plan_activity_schedule enable row level security;

drop policy if exists "members read their plan schedule" on public.plan_activity_schedule;
create policy "members read their plan schedule"
  on public.plan_activity_schedule for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members add plan schedule entries" on public.plan_activity_schedule;
create policy "members add plan schedule entries"
  on public.plan_activity_schedule for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and exists (
      select 1 from public.children c
      where c.id = child_id and c.family_id = plan_activity_schedule.family_id
    )
  );

drop policy if exists "members update their plan schedule" on public.plan_activity_schedule;
create policy "members update their plan schedule"
  on public.plan_activity_schedule for update to authenticated
  using (public.is_family_member(family_id))
  with check (
    public.is_family_member(family_id)
    and exists (
      select 1 from public.children c
      where c.id = child_id and c.family_id = plan_activity_schedule.family_id
    )
  );

drop policy if exists "members remove their plan schedule entries" on public.plan_activity_schedule;
create policy "members remove their plan schedule entries"
  on public.plan_activity_schedule for delete to authenticated
  using (public.is_family_member(family_id));
