import {
  ageInMonths,
  buildAgeTemplatePlan,
  MONTH_PLAN_SUBJECT,
  type FourWeekPlan,
  type PlanWeek,
} from "@homa/core";

import { profileInterestList } from "./map/profile-context";

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
  /**
   * True when this week was derived from the child's AGE rather than
   * from anything the parent has told us, and is not stored.
   *
   * It exists so a parent ninety seconds into onboarding sees a real
   * week instead of an empty grid (founder ask 2026-07-29). The
   * activities are genuine, built by the same builder as any other
   * plan, but nobody has said anything about this child yet and every
   * surface that renders one owes her that distinction in words. Never
   * describe a provisional week as built from her answers, and never
   * write check-offs against one.
   */
  provisional?: boolean;
}

/**
 * withAgeTemplates(children, stored): adds a provisional month for any
 * child who has no stored one, derived from their age.
 *
 * Before this, a family had an empty planner until someone scored a
 * report AND a month got built, which walk 005 watched land as "There's
 * no month set up for Ellie yet" at the exact beat meant to show her
 * that Homa holds her year (founder ruling
 * onboarding-lesson-per-subject, 2026-07-29). A birthday is enough to
 * do better: buildAgeTemplatePlan produces the month a typical child of
 * that age would get, with this child's own interests already in the
 * activity text, and for a typical child it is the same month her
 * answers would have produced.
 *
 * Not stored, and flagged provisional the whole way out, because it
 * describes children of this age rather than her child. The retest
 * clock is synthetic so the week grid can place week one; it is not a
 * promise about a date, and nothing writes check-offs against it.
 *
 * Lives here, beside DashboardPlan, because BOTH plan readers need it:
 * getPlanBoard for the agent's planner tool and the /app pages through
 * app-data. Wiring only one of them is how the first attempt shipped a
 * week Homa could describe and the page would not show.
 */
export function withAgeTemplates(
  // `profile` stays unknown so both callers fit: the agent path reads a
  // raw jsonb column, the /app path reads a typed ChildProfile, and
  // profileInterestList validates either one.
  children: readonly { id: string; birth_month: string; profile?: unknown }[],
  stored: readonly DashboardPlan[],
  nowMs: number = Date.now(),
): DashboardPlan[] {
  const hasMonth = new Set(
    stored.filter((plan) => plan.subjectId === MONTH_PLAN_SUBJECT).map((plan) => plan.childId),
  );
  const provisional = children.flatMap((child) => {
    if (hasMonth.has(child.id)) return [];
    const profile = (child.profile ?? {}) as { interests?: unknown };
    const template = buildAgeTemplatePlan(ageInMonths(child.birth_month), {
      interests: profileInterestList(profile.interests),
    });
    if (!template) return [];
    return [
      {
        childId: child.id,
        subjectId: MONTH_PLAN_SUBJECT,
        done: 0,
        total: template.weeks.reduce((sum, week) => sum + week.activities.length, 0),
        // Week one starts today: retestAt minus 28 days is read as the
        // plan's first day everywhere, so this lands her in week 1.
        retestAt: new Date(nowMs + 28 * 24 * 60 * 60 * 1000).toISOString(),
        weeks: template.weeks,
        progress: {},
        provisional: true,
      } satisfies DashboardPlan,
    ];
  });
  return [...stored, ...provisional];
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

/**
 * D17, birthday on the board
 * (plans/2026-07-21-chat-first-onboarding.md §4.2): the age a child
 * turns if their birthday falls on this exact calendar day, or null.
 * Render-only and computed client-side on purpose ("moms screenshot
 * this"); nothing here is persisted or scored.
 *
 * `birthMonth` is children.birth_month, a full YYYY-MM-DD date despite
 * its name (migration #55: "the map claim path has written real days
 * since 2026-07-06"). Rows from the brief 2026-07-08 to 2026-07-11
 * month-only window carry day 01, so those children simply never match
 * a real cell, which is the honest outcome for data that was never
 * collected.
 */
export function childTurnsAgeOn(
  birthMonth: string,
  cell: { year: number; month: number; day: number },
): number | null {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthMonth.trim());
  if (!parsed) return null;
  const [, birthYear, birthMonthNumber, birthDay] = parsed;
  if (Number(birthMonthNumber) !== cell.month || Number(birthDay) !== cell.day) {
    return null;
  }
  const age = cell.year - Number(birthYear);
  return age >= 0 ? age : null;
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
