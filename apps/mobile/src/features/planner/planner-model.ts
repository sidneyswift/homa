import type { ChildPlanRecord } from "../../lib/child-plans";
import type { PlanActivityScheduleRecord } from "../../lib/plan-schedule";
import type { ChildRecord } from "../../lib/family";

/**
 * Joins plan_activity_schedule's dates with child_plans' text, ported
 * from apps/web/lib/plan-schedule.ts's read-side join (buildCalendarBoard):
 * a schedule row whose (week, activityIndex) no longer resolves in the
 * current plan (an out-of-bounds index after a plan rebuild) is dropped
 * silently rather than shown with wrong or missing text, matching web's
 * documented behavior exactly.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** currentWeekIndex ported from apps/web/lib/plan-week.ts: the plan's
 * clock is always armed 28 days before retestAt, so "now" lands in
 * whichever of the four weeks that puts it in, clamped to the plan's
 * length. Returns a 1-based week number (matching the schema's `week`
 * column), not the 0-based index web's version returns. */
export function currentWeekNumber(retestAt: string | null, weekCount: number): number {
  if (weekCount === 0) return 1;
  if (!retestAt) return 1;
  const planStartMs = new Date(retestAt).getTime() - 28 * 24 * 60 * 60 * 1000;
  const elapsedWeeks = Math.floor((Date.now() - planStartMs) / WEEK_MS);
  return Math.min(Math.max(elapsedWeeks, 0), weekCount - 1) + 1;
}

export interface PlanActivityView {
  childId: string;
  childIndex: number;
  childName: string;
  subjectId: string;
  subjectName: string;
  week: number;
  activityIndex: number;
  text: string;
  done: boolean;
}

export interface ScheduledActivityView extends PlanActivityView {
  scheduleId: string;
  scheduledDate: string;
}

function activityText(plan: ChildPlanRecord["plan"], week: number, activityIndex: number): string | null {
  const weekEntry = plan.weeks.find((entry) => entry.week === week);
  return weekEntry?.activities[activityIndex] ?? null;
}

function childIndexOf(children: ChildRecord[], childId: string): number {
  const index = children.findIndex((child) => child.id === childId);
  return index === -1 ? 0 : index;
}

export function buildScheduledActivities(
  scheduleRows: PlanActivityScheduleRecord[],
  childPlans: ChildPlanRecord[],
  children: ChildRecord[],
): ScheduledActivityView[] {
  const views: ScheduledActivityView[] = [];
  for (const row of scheduleRows) {
    const plan = childPlans.find(
      (entry) => entry.child_id === row.child_id && entry.subject_id === row.subject_id,
    );
    if (!plan) continue;
    const text = activityText(plan.plan, row.week, row.activity_index);
    if (text === null) continue;
    const child = children.find((entry) => entry.id === row.child_id);
    views.push({
      scheduleId: row.id,
      childId: row.child_id,
      childIndex: childIndexOf(children, row.child_id),
      childName: child?.name ?? "",
      subjectId: row.subject_id,
      subjectName: plan.plan.subjectName,
      week: row.week,
      activityIndex: row.activity_index,
      text,
      done: Boolean(plan.progress[`${row.week}.${row.activity_index}`]),
      scheduledDate: row.scheduled_date,
    });
  }
  return views;
}

/** The current week's activities that have no scheduled_date yet: the
 * "put this on a day" tray. Mobile's own addition — web has no direct
 * scheduling UI today, only the schedule_plan_activity chat tool. */
export function buildUnscheduledActivities(
  childPlans: ChildPlanRecord[],
  scheduleRows: PlanActivityScheduleRecord[],
  children: ChildRecord[],
): PlanActivityView[] {
  const views: PlanActivityView[] = [];
  for (const plan of childPlans) {
    const week = currentWeekNumber(plan.retest_at, plan.plan.weeks.length);
    const weekEntry = plan.plan.weeks.find((entry) => entry.week === week);
    if (!weekEntry) continue;
    const child = children.find((entry) => entry.id === plan.child_id);
    weekEntry.activities.forEach((text, activityIndex) => {
      const isScheduled = scheduleRows.some(
        (row) =>
          row.child_id === plan.child_id &&
          row.subject_id === plan.subject_id &&
          row.week === week &&
          row.activity_index === activityIndex,
      );
      if (isScheduled) return;
      views.push({
        childId: plan.child_id,
        childIndex: childIndexOf(children, plan.child_id),
        childName: child?.name ?? "",
        subjectId: plan.subject_id,
        subjectName: plan.plan.subjectName,
        week,
        activityIndex,
        text,
        done: Boolean(plan.progress[`${week}.${activityIndex}`]),
      });
    });
  }
  return views;
}
