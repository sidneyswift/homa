import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import {
  familyAssetReferencesForSurface,
  type FamilyAssetReference,
} from "./library/family-asset-reference";
import { planActivitySourceSnapshots } from "./map/plan-source-links";
import type { DashboardPlan } from "./plan-week";
import { currentWeekIndex } from "./plan-week";
import { scheduleKey } from "./plan-schedule";

/**
 * open_planner's payload shaping (issue #257, arc PR B0), pure so the
 * bounding rules are unit-testable without a database or a session.
 *
 * The rule, council-settled over the single-payload alternative
 * (plans/2026-07-27-planner-calendar-ecosystem.md §4.3.1): the payload
 * is MODEL GROUNDING, not the whole board.
 *
 *   - A childId-narrowed call is the turn addressing that child's
 *     plans, so those plans return ALL FOUR weeks in full, each
 *     activity carrying its real scheduledDate (or null when the
 *     parent has not put it on a day).
 *   - A family-wide call returns each plan's CURRENT week in full plus
 *     one-line summaries of the other weeks, so a large family stays
 *     inside a sane token budget while non-current-week edits still
 *     have a door: call again with childId.
 *
 * Every activity in a full week carries scheduledDate so the skill's
 * reshuffle procedure ("gather the real scheduled activities") is
 * finally executable; before this, no tool read plan_activity_schedule
 * at all. scheduledTime will join when the column exists (arc PR E);
 * inventing the field early would be a shape lie.
 *
 * This module never touches next/headers, so agent tools may import it
 * (the same eve-build constraint lib/plan-schedule.ts documents).
 */

export interface PlannerActivity {
  /** The activity's index within its week: what edit_plan and
   * schedule_plan_activity address. */
  index: number;
  text: string;
  done: boolean;
  /** The real persisted date (YYYY-MM-DD) from plan_activity_schedule,
   * or null when the activity has never been put on a day. */
  scheduledDate: string | null;
  /** Family Library resources that grounded this activity. */
  sources: FamilyAssetReference[];
}

export interface PlannerWeekDetail {
  /** 1 through 4: what edit_plan and schedule_plan_activity address. */
  weekNumber: number;
  focus: string;
  current: boolean;
  activities: PlannerActivity[];
}

/** A one-line week: enough to know whether a week needs opening in
 * full, never enough to edit it from (indices live in the detail). */
export interface PlannerWeekSummary {
  weekNumber: number;
  focus: string;
  activityCount: number;
  doneCount: number;
  /** How many of the week's activities already sit on a real date. */
  scheduledCount: number;
}

export interface PlannerPlanPayload {
  subjectId: string;
  subjectName: string;
  /** The revision that must accompany any edit or schedule write. Null is
   * reserved for an unsaved provisional age-based plan. */
  planRevision: number | null;
  currentWeekNumber: number;
  doneCount: number;
  totalCount: number;
  retestDue: boolean;
  /** All four weeks on a childId-narrowed call; just the current week
   * otherwise. */
  weeks: PlannerWeekDetail[];
  /** The weeks not shown in full (family-wide calls only). */
  weekSummaries?: PlannerWeekSummary[];
  /**
   * True when this week came from the child's AGE, not from anything
   * the parent has told us, and is not stored.
   *
   * The activities are real and built by the same builder as any other
   * plan, but the child has no answers yet, so it describes children of
   * this age rather than this child. Say so. Never call a provisional
   * week something you built from her answers, and never edit or
   * schedule against one: it has no row to write to.
   */
  provisional?: boolean;
}

export function subjectDisplayName(subjectId: string): string {
  if (subjectId === MONTH_PLAN_SUBJECT) return "The month";
  return getMapSubject(subjectId)?.displayName ?? subjectId;
}

export function shapePlannerPlan(
  plan: DashboardPlan,
  options: {
    nowMs: number;
    /** True when the call named this plan's child: full four weeks. */
    fullWeeks: boolean;
    /** scheduleKey -> YYYY-MM-DD, from scheduledDatesByActivity. */
    scheduledDates: ReadonlyMap<string, string>;
    /** Optional deployment origin for channel-safe Library links. */
    siteRoot?: string;
  },
): PlannerPlanPayload {
  const currentIdx = currentWeekIndex(plan, options.nowMs);
  const detail = (weekIdx: number): PlannerWeekDetail => {
    const week = plan.weeks[weekIdx];
    return {
      weekNumber: week.week,
      focus: week.focus,
      current: weekIdx === currentIdx,
      activities: week.activities.map((text, index) => ({
        index,
        text,
        done: Boolean(plan.progress[`${week.week}.${index}`]),
        scheduledDate:
          options.scheduledDates.get(
            scheduleKey(plan.childId, plan.subjectId, week.week, index),
          ) ?? null,
        sources: familyAssetReferencesForSurface(
          planActivitySourceSnapshots(plan, week.week, index),
          { siteRoot: options.siteRoot },
        ),
      })),
    };
  };
  const summary = (weekIdx: number): PlannerWeekSummary => {
    const week = plan.weeks[weekIdx];
    let doneCount = 0;
    let scheduledCount = 0;
    week.activities.forEach((_text, index) => {
      if (plan.progress[`${week.week}.${index}`]) doneCount += 1;
      if (
        options.scheduledDates.has(
          scheduleKey(plan.childId, plan.subjectId, week.week, index),
        )
      ) {
        scheduledCount += 1;
      }
    });
    return {
      weekNumber: week.week,
      focus: week.focus,
      activityCount: week.activities.length,
      doneCount,
      scheduledCount,
    };
  };

  const base = {
    subjectId: plan.subjectId,
    subjectName: subjectDisplayName(plan.subjectId),
    planRevision: plan.planRevision,
    currentWeekNumber: plan.weeks[currentIdx]?.week ?? 1,
    doneCount: plan.done,
    totalCount: plan.total,
    // A provisional week has a synthetic clock 28 days out, so it can
    // never be due; guarded anyway, because "your retest is due" about a
    // week she has never seen would be nonsense.
    retestDue: !plan.provisional && new Date(plan.retestAt).getTime() <= options.nowMs,
    ...(plan.provisional ? { provisional: true as const } : {}),
  };
  if (options.fullWeeks) {
    return {
      ...base,
      weeks: plan.weeks.map((_week, weekIdx) => detail(weekIdx)),
    };
  }
  return {
    ...base,
    weeks: [detail(currentIdx)],
    weekSummaries: plan.weeks
      .map((_week, weekIdx) => weekIdx)
      .filter((weekIdx) => weekIdx !== currentIdx)
      .map((weekIdx) => summary(weekIdx)),
  };
}
