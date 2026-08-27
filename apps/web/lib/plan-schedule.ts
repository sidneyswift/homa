import type { SupabaseClient } from "@supabase/supabase-js";
import type { FourWeekPlan } from "@homa/core";
import { z } from "zod";

import { mapDb } from "./map/db";

/**
 * plan_activity_schedule (issue #176, CG-03): the real per-day scheduling
 * substrate the codebase has named as unbuilt since the week board
 * shipped (apps/web/app/app/planner/day-grid.tsx, spread-week.ts). This
 * gives one plan activity (a child + subject plan's week + activity
 * index, exactly what open_planner and edit_plan already address by)
 * a real persisted calendar date, without touching FourWeekPlan/PlanWeek
 * (packages/core/src/map/plans.ts) at all.
 *
 * Same caller/pinned split as family-events.ts and hours_log: the
 * Planner page reads under the caller's own RLS session, and the
 * schedule_plan_activity tool supports both a web session (caller's own
 * client) and a pinned channel like SMS (mapDb, explicit family_id
 * predicate). Every write re-validates the activity actually exists at
 * that week/index in the family's own current plan before writing, so a
 * stale or invented index can never create a schedule row that points
 * nowhere real.
 *
 * The caller-page read lives in its own file, plan-schedule-read.ts:
 * createSupabaseServerClient pulls in next/headers, which eve's
 * standalone tool build cannot resolve. No agent tool may import that
 * file; every function agent tools use lives here instead. Same split
 * and reasoning as lib/family-events.ts / lib/family-events-read.ts.
 */

export const WRONG_CHILD_NOTE_FOR_SCHEDULE =
  "That child id is not in this family. Use a child id from the family context block.";

export interface PlanActivityScheduleRow {
  id: string;
  familyId: string;
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  /** YYYY-MM-DD. */
  scheduledDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulePlanActivityInput {
  /** Server-chosen id for a newly armed Voice receipt. Never model input. */
  id?: string;
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  /** The plan revision returned by open_planner when this choice was made. */
  planRevision: number;
  /** Exact activity text returned by open_planner, never a positional guess. */
  expectedText: string;
  /** YYYY-MM-DD. */
  scheduledDate: string;
}

export async function getPlanActivitySchedulePinned(
  familyId: string,
  input: Pick<SchedulePlanActivityInput, "childId" | "subjectId" | "week" | "activityIndex">,
): Promise<PlanActivityScheduleRow | null> {
  const sql = mapDb();
  const rows = await sql<{
    id: string;
    family_id: string;
    child_id: string;
    subject_id: string;
    week: number;
    activity_index: number;
    scheduled_date: string;
    created_at: string;
    updated_at: string;
  }[]>`
    select id, family_id, child_id, subject_id, week, activity_index,
           to_char(scheduled_date, 'YYYY-MM-DD') as scheduled_date,
           created_at::text, updated_at::text
    from public.plan_activity_schedule
    where family_id = ${familyId} and child_id = ${input.childId}
      and subject_id = ${input.subjectId} and week = ${input.week}
      and activity_index = ${input.activityIndex}
  `;
  const row = rows[0];
  return row ? {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    subjectId: row.subject_id,
    week: row.week,
    activityIndex: row.activity_index,
    scheduledDate: row.scheduled_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } : null;
}

export type SchedulePlanActivityResult =
  | {
      scheduled: true;
      childId: string;
      subjectId: string;
      week: number;
      activityIndex: number;
      scheduledDate: string;
      /** The activity's own text, read fresh from the plan, so the
       * caller can confirm exactly what got a date without re-fetching. */
      activityText: string;
    }
  | { scheduled: false; note: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The activity's own text at (week, activityIndex), or null when that
 * slot does not exist in the plan right now (an invented index, or one
 * shifted/removed since the caller last read open_planner). Exported
 * for unit tests; also used by both write paths below. */
export function activityTextAt(
  plan: FourWeekPlan,
  week: number,
  activityIndex: number,
): string | null {
  const weekRow = plan.weeks.find((entry) => entry.week === week);
  if (!weekRow) return null;
  return weekRow.activities[activityIndex] ?? null;
}

const STALE_PLAN_NOTE =
  "That plan changed while the date was being saved. Open the planner again and choose the day from the current activity.";
const INVALID_RECEIPT_NOTE =
  "Homa could not prove which activity received that date. Open the planner again before trying once more.";

const scheduleReceiptSchema = z.object({
  status: z.enum(["applied", "conflict"]),
  reason: z.string().nullable(),
  family_id: z.string().uuid().nullable(),
  plan_id: z.string().uuid().nullable(),
  plan_revision: z.union([
    z.number().int(),
    z.string().regex(/^\d+$/u).transform(Number),
  ]).nullable(),
  scheduled_date: z.string().nullable(),
  activity_text: z.string().nullable(),
  schedule_id: z.string().uuid().nullable(),
});

type ScheduleReceipt = z.infer<typeof scheduleReceiptSchema>;

function scheduleConflictNote(reason: string | null): string {
  return reason === "activity-mismatch" || reason === "revision-mismatch"
    ? STALE_PLAN_NOTE
    : "That activity is no longer available in this plan. Open the planner again before choosing a date.";
}

function parseScheduleReceipt(
  data: unknown,
  input: SchedulePlanActivityInput,
  familyId: string,
): { ok: true; receipt: ScheduleReceipt } | { ok: false; note: string } {
  const parsed = z.array(scheduleReceiptSchema).length(1).safeParse(data);
  if (!parsed.success) return { ok: false, note: INVALID_RECEIPT_NOTE };
  const receipt = parsed.data[0];
  if (receipt.status === "conflict") {
    return { ok: false, note: scheduleConflictNote(receipt.reason) };
  }
  if (
    receipt.family_id !== familyId
    || receipt.plan_id === null
    || receipt.plan_revision !== input.planRevision
    || receipt.scheduled_date !== input.scheduledDate
    || receipt.activity_text !== input.expectedText
    || receipt.schedule_id === null
  ) {
    return { ok: false, note: INVALID_RECEIPT_NOTE };
  }
  return { ok: true, receipt };
}

export function validateScheduleInput(
  input: SchedulePlanActivityInput,
): { ok: true } | { ok: false; note: string } {
  if (!DATE_RE.test(input.scheduledDate)) {
    return { ok: false, note: "scheduledDate must be a real calendar date, YYYY-MM-DD." };
  }
  if (!Number.isInteger(input.week) || input.week < 1 || input.week > 4) {
    return { ok: false, note: "week must be 1 through 4." };
  }
  if (!Number.isInteger(input.activityIndex) || input.activityIndex < 0) {
    return { ok: false, note: "activityIndex must be 0 or a positive whole number." };
  }
  if (!Number.isInteger(input.planRevision) || input.planRevision < 1) {
    return { ok: false, note: "planRevision must be a positive whole number from open_planner." };
  }
  if (
    typeof input.expectedText !== "string"
    || input.expectedText.trim().length === 0
    || input.expectedText.length > 4000
  ) {
    return { ok: false, note: "expectedText must be the exact activity text from open_planner." };
  }
  return { ok: true };
}

const NO_PLAN_NOTE =
  "This child has no plan for that subject. Open the planner first to see what plans exist.";
const NO_ACTIVITY_NOTE =
  "That week or activity index does not exist in the current plan. Read open_planner again before scheduling; the plan may have changed.";

export async function schedulePlanActivityCaller(
  db: SupabaseClient,
  familyId: string,
  input: SchedulePlanActivityInput,
): Promise<SchedulePlanActivityResult> {
  const validated = validateScheduleInput(input);
  if (!validated.ok) return { scheduled: false, note: validated.note };
  const rpc = await db.rpc("schedule_plan_activity_v2", {
    target_child_id: input.childId,
    target_subject_id: input.subjectId,
    target_week: input.week,
    target_activity_index: input.activityIndex,
    target_scheduled_date: input.scheduledDate,
    target_expected_text: input.expectedText,
    target_plan_revision: input.planRevision,
    target_schedule_id: input.id ?? null,
  });
  const parsed = parseScheduleReceipt(rpc.data, input, familyId);
  if (!parsed.ok) return { scheduled: false, note: parsed.note };
  return {
    scheduled: true,
    childId: input.childId,
    subjectId: input.subjectId,
    week: input.week,
    activityIndex: input.activityIndex,
    scheduledDate: input.scheduledDate,
    activityText: input.expectedText,
  };
}

export async function schedulePlanActivityPinned(
  familyId: string,
  input: SchedulePlanActivityInput,
): Promise<SchedulePlanActivityResult> {
  const validated = validateScheduleInput(input);
  if (!validated.ok) return { scheduled: false, note: validated.note };

  const sql = mapDb();
  return sql.begin(async (tx) => {
    const childRows = await tx<{ id: string }[]>`
      select id
      from public.children
      where id = ${input.childId} and family_id = ${familyId}
      for update
    `;
    if (!childRows[0]) return { scheduled: false, note: WRONG_CHILD_NOTE_FOR_SCHEDULE };

    const planRows = await tx<{
      id: string;
      plan: FourWeekPlan;
      plan_revision: number | string;
    }[]>`
      select id, plan, plan_revision
      from public.child_plans
      where child_id = ${input.childId} and subject_id = ${input.subjectId}
      for update
    `;
    const planRow = planRows[0];
    if (!planRow) return { scheduled: false, note: NO_PLAN_NOTE };
    if (Number(planRow.plan_revision) !== input.planRevision) {
      return { scheduled: false, note: STALE_PLAN_NOTE };
    }
    const activityText = activityTextAt(planRow.plan, input.week, input.activityIndex);
    if (activityText === null) return { scheduled: false, note: NO_ACTIVITY_NOTE };
    if (activityText !== input.expectedText) {
      return { scheduled: false, note: STALE_PLAN_NOTE };
    }

    const rows = await tx<{ id: string }[]>`
      insert into public.plan_activity_schedule
        (id, family_id, child_id, subject_id, week, activity_index, scheduled_date)
      values
        (coalesce(${input.id ?? null}::uuid, gen_random_uuid()), ${familyId},
         ${input.childId}, ${input.subjectId}, ${input.week},
         ${input.activityIndex}, ${input.scheduledDate})
      on conflict (family_id, child_id, subject_id, week, activity_index)
      do update set scheduled_date = excluded.scheduled_date, updated_at = now()
      returning id
    `;
    if (!rows[0]) return { scheduled: false, note: INVALID_RECEIPT_NOTE };
    return {
      scheduled: true,
      childId: input.childId,
      subjectId: input.subjectId,
      week: input.week,
      activityIndex: input.activityIndex,
      scheduledDate: input.scheduledDate,
      activityText,
    };
  });
}

/**
 * One activity's persisted date, as open_planner reads it back (issue
 * #257, arc PR B0): before this read existed, no tool read
 * plan_activity_schedule at all, so Homa wrote dates she could never
 * see again and the skill's reshuffle procedure was unexecutable. Same
 * posture as getPlanBoard: server connection, explicit family_id
 * predicate, works identically for caller-JWT web sessions and pinned
 * channels. This file (never plan-schedule-read.ts, which pulls
 * next/headers) is the only schedule module agent tools may import.
 */
export interface ScheduledDateRow {
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  /** YYYY-MM-DD. */
  scheduledDate: string;
}

/** The lookup key open_planner joins schedule rows to activities by. */
export function scheduleKey(
  childId: string,
  subjectId: string,
  week: number,
  activityIndex: number,
): string {
  return `${childId}:${subjectId}:${week}.${activityIndex}`;
}

/** Rows folded into a scheduleKey -> date map. Duplicate keys cannot
 * happen (the table's natural key is unique), so last-write-wins here
 * is only a formality. */
export function scheduledDatesByActivity(
  rows: readonly ScheduledDateRow[],
): Map<string, string> {
  const dates = new Map<string, string>();
  for (const row of rows) {
    dates.set(
      scheduleKey(row.childId, row.subjectId, row.week, row.activityIndex),
      row.scheduledDate,
    );
  }
  return dates;
}

/**
 * Every scheduled date for one family, optionally narrowed to one child
 * (the childId arrives already re-scoped by the caller's board read;
 * the family predicate here still stands on its own). Bounded by
 * construction: a family has at most a handful of plans, each 4 weeks
 * of at most 10 activities.
 */
export async function listScheduledDatesPinned(
  familyId: string,
  childId?: string | null,
): Promise<ScheduledDateRow[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      child_id: string;
      subject_id: string;
      week: number;
      activity_index: number;
      scheduled_date: string;
    }[]
  >`
    select child_id, subject_id, week, activity_index,
           to_char(scheduled_date, 'YYYY-MM-DD') as scheduled_date
    from public.plan_activity_schedule
    where family_id = ${familyId}
      ${childId ? sql`and child_id = ${childId}` : sql``}
  `;
  return rows.map((row) => ({
    childId: row.child_id,
    subjectId: row.subject_id,
    week: row.week,
    activityIndex: row.activity_index,
    scheduledDate: row.scheduled_date,
  }));
}

export interface ScheduledActivityCandidate {
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  scheduledDate: string;
  /** null when the plan changed since the date was saved and the slot no
   * longer holds text; still worth surfacing as "something is scheduled". */
  activityText: string | null;
}

/**
 * Same-day generated-plan activities already scheduled for any of these
 * children under this exact subjectId, so record_planner_activity's
 * duplicate guard can surface them (gh#1015) instead of silently logging a
 * second, independent row for work that is already on the calendar.
 * subjectId is matched literally against the caller's HoursSubject string:
 * real but coincidental overlap (both call it "math"), never a maintained
 * cross-taxonomy mapping, so this only catches subjects spelled the same
 * way in both places, never a false cross-subject match.
 */
export async function findScheduledActivityCandidates(input: {
  familyId: string;
  childIds: readonly string[];
  subjectId: string;
  activityDate: string;
}): Promise<ScheduledActivityCandidate[]> {
  if (input.childIds.length === 0) return [];
  const sql = mapDb();
  const rows = await sql<{
    child_id: string;
    subject_id: string;
    week: number;
    activity_index: number;
    scheduled_date: string;
    plan: FourWeekPlan | null;
  }[]>`
    select schedule.child_id, schedule.subject_id, schedule.week,
           schedule.activity_index,
           to_char(schedule.scheduled_date, 'YYYY-MM-DD') as scheduled_date,
           plan.plan
    from public.plan_activity_schedule schedule
    left join public.child_plans plan
      on plan.child_id = schedule.child_id and plan.subject_id = schedule.subject_id
    where schedule.family_id = ${input.familyId}
      and schedule.subject_id = ${input.subjectId}
      and schedule.scheduled_date = ${input.activityDate}
      and schedule.child_id = any(${sql.array([...input.childIds])}::uuid[])
    limit 5
  `;
  return rows.map((row) => ({
    childId: row.child_id,
    subjectId: row.subject_id,
    week: row.week,
    activityIndex: row.activity_index,
    scheduledDate: row.scheduled_date,
    activityText: row.plan ? activityTextAt(row.plan, row.week, row.activity_index) : null,
  }));
}

/** Exported so plan-schedule-read.ts (the caller-page read) can shape
 * its own Data API rows without duplicating this mapping. */
export interface RawScheduleRow {
  id: string;
  family_id: string;
  child_id: string;
  subject_id: string;
  week: number;
  activity_index: number;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
}

export function toScheduleRow(row: RawScheduleRow): PlanActivityScheduleRow {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    subjectId: row.subject_id,
    week: row.week,
    activityIndex: row.activity_index,
    scheduledDate: row.scheduled_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The Data API column list plan-schedule-read.ts's page query selects. */
export const SCHEDULE_COLUMNS =
  "id, family_id, child_id, subject_id, week, activity_index, scheduled_date, created_at, updated_at";
