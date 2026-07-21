import type { FourWeekPlan, PlanWeek } from "@homa/core";

/**
 * Pure plan-week helpers, split out of dashboard.ts so client surfaces
 * (the chat's planner canvas) can compute week positions without
 * pulling the server-only Supabase reads into their bundle. dashboard.ts
 * re-exports everything here, so server callers keep their old imports.
 */

export interface DashboardPlan {
  childId: string;
  subjectId: string;
  /** Check-offs done vs total activities, counted from the synced map. */
  done: number;
  total: number;
  retestAt: string;
  /** The four weeks themselves, for the planner's this-week board. */
  weeks: PlanWeek[];
  /** Server-synced check-offs, keyed "week.activityIndex". */
  progress: Record<string, boolean>;
}

/** The plan's first day: the retest clock is armed 28 days out when the
 * plan is built, so the start is always retestAt minus four weeks. */
function planStartMs(plan: Pick<DashboardPlan, "retestAt">): number {
  return new Date(plan.retestAt).getTime() - 28 * 24 * 60 * 60 * 1000;
}

/** Which of the four weeks the family is living right now (0-based,
 * clamped so a plan past its retest still shows week 4, never crashes). */
export function currentWeekIndex(
  plan: Pick<DashboardPlan, "retestAt" | "weeks">,
  nowMs: number,
): number {
  if (plan.weeks.length === 0) return 0;
  const elapsedWeeks = Math.floor((nowMs - planStartMs(plan)) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(elapsedWeeks, 0), plan.weeks.length - 1);
}

export function validPlanWeek(value: unknown): value is PlanWeek {
  if (!value || typeof value !== "object") return false;
  const week = value as Partial<PlanWeek>;
  return (
    typeof week.week === "number" &&
    typeof week.focus === "string" &&
    Array.isArray(week.activities) &&
    week.activities.every((activity) => typeof activity === "string")
  );
}

/** One child_plans row shaped for the board, shared by the server reads
 * and the canvas payload. Rows whose plan JSON carries no valid weeks
 * are dropped (never rendered half-broken). */
export function dashboardPlanFromRow(row: {
  child_id: string;
  subject_id: string;
  plan: FourWeekPlan;
  progress: Record<string, boolean> | null;
  retest_at: string;
}): DashboardPlan | null {
  const weeks = Array.isArray(row.plan?.weeks) ? row.plan.weeks.filter(validPlanWeek) : [];
  if (weeks.length === 0) return null;
  const progress = (row.progress ?? {}) as Record<string, boolean>;
  return {
    childId: row.child_id,
    subjectId: row.subject_id,
    done: Object.values(progress).filter(Boolean).length,
    total: weeks.reduce((sum, week) => sum + week.activities.length, 0),
    retestAt: row.retest_at,
    weeks,
    progress,
  };
}
