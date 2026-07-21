import type { FourWeekPlan, PlanWeek } from "@homa/core";

import { supabase } from "./supabase";

/**
 * Planner reads for the signed-in app, ported from the server reads in
 * apps/web/lib/dashboard.ts and the pure plan-week helpers in
 * apps/web/lib/plan-week.ts (keep the shapes and rules in sync with
 * those files until a shared package exists). Every query runs under the
 * caller's RLS context, so rows are family-scoped by the database
 * itself, not by trust in this code. Read-only on purpose: plan
 * check-offs are written through the web server's plan-edits path,
 * never by a raw client write (founder ruling, planner-canvas-chat),
 * so this module has no write functions at all.
 */

/** The slice of a child row the week board reads (the mobile twin of
 * planner-view.tsx's PlannerKid). */
export interface PlannerChild {
  id: string;
  name: string;
  birth_month: string;
  avatar_url: string | null;
}

/** One child's plan shaped for the board (web's DashboardPlan, minus the
 * done/total counts the mobile board does not render). */
export interface PlannerPlan {
  childId: string;
  subjectId: string;
  retestAt: string;
  /** The four weeks themselves, for the this-week board. */
  weeks: PlanWeek[];
  /** Server-synced check-offs, keyed "week.activityIndex". */
  progress: Record<string, boolean>;
}

export interface PlannerData {
  /** The family's IANA zone, null until TimeZoneSync captures one. */
  timeZone: string | null;
  children: PlannerChild[];
  /** childId to permanent report token; absent means no report yet. */
  reportTokens: Map<string, string>;
  plans: PlannerPlan[];
}

/** The plan's first day: the retest clock is armed 28 days out when the
 * plan is built, so the start is always retestAt minus four weeks. */
function planStartMs(plan: Pick<PlannerPlan, "retestAt">): number {
  return new Date(plan.retestAt).getTime() - 28 * 24 * 60 * 60 * 1000;
}

/** Which of the four weeks the family is living right now (0-based,
 * clamped so a plan past its retest still shows week 4, never crashes). */
export function currentWeekIndex(
  plan: Pick<PlannerPlan, "retestAt" | "weeks">,
  nowMs: number,
): number {
  if (plan.weeks.length === 0) return 0;
  const elapsedWeeks = Math.floor((nowMs - planStartMs(plan)) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(elapsedWeeks, 0), plan.weeks.length - 1);
}

function validPlanWeek(value: unknown): value is PlanWeek {
  if (!value || typeof value !== "object") return false;
  const week = value as Partial<PlanWeek>;
  return (
    typeof week.week === "number" &&
    typeof week.focus === "string" &&
    Array.isArray(week.activities) &&
    week.activities.every((activity) => typeof activity === "string")
  );
}

/** One child_plans row shaped for the board. Rows whose plan JSON
 * carries no valid weeks are dropped (never rendered half-broken),
 * same as web's dashboardPlanFromRow. */
function plannerPlanFromRow(row: {
  child_id: string;
  subject_id: string;
  plan: FourWeekPlan;
  progress: Record<string, boolean> | null;
  retest_at: string;
}): PlannerPlan | null {
  const weeks = Array.isArray(row.plan?.weeks) ? row.plan.weeks.filter(validPlanWeek) : [];
  if (weeks.length === 0) return null;
  return {
    childId: row.child_id,
    subjectId: row.subject_id,
    retestAt: row.retest_at,
    weeks,
    progress: (row.progress ?? {}) as Record<string, boolean>,
  };
}

/**
 * getPlannerData(): PlannerData | null
 * Null means setup is unfinished (no family, family card not done, or no
 * kids yet); the screen offers the web onboarding, mirroring web
 * page.tsx's redirect. Reads its own family row rather than reusing
 * lib/family.ts because the planner needs time_zone and each kid's
 * avatar_url, which the shared reads do not select.
 */
export async function getPlannerData(): Promise<PlannerData | null> {
  const { data: family, error: familyError } = await supabase
    .from("families")
    .select("id, time_zone, profile_completed_at")
    .limit(1)
    .maybeSingle();
  if (familyError) throw new Error(`families read failed: ${familyError.message}`);
  if (!family || !family.profile_completed_at) return null;

  const { data: childRows, error: childrenError } = await supabase
    .from("children")
    .select("id, name, birth_month, avatar_url")
    .eq("family_id", family.id)
    .order("created_at", { ascending: true });
  if (childrenError) throw new Error(`children read failed: ${childrenError.message}`);
  const children = (childRows ?? []) as PlannerChild[];
  if (children.length === 0) return null;

  const childIds = children.map((child) => child.id);
  const [reportsResult, plansResult] = await Promise.all([
    supabase.from("child_reports").select("child_id, token").in("child_id", childIds),
    supabase
      .from("child_plans")
      .select("child_id, subject_id, plan, progress, retest_at")
      .in("child_id", childIds),
  ]);
  if (reportsResult.error) {
    throw new Error(`child_reports read failed: ${reportsResult.error.message}`);
  }
  if (plansResult.error) {
    throw new Error(`child_plans read failed: ${plansResult.error.message}`);
  }

  const reportTokens = new Map<string, string>();
  for (const row of reportsResult.data ?? []) {
    if (typeof row.token === "string" && row.token) {
      reportTokens.set(row.child_id as string, row.token);
    }
  }

  const plans = (plansResult.data ?? []).flatMap((row) => {
    const shaped = plannerPlanFromRow({
      child_id: row.child_id as string,
      subject_id: row.subject_id as string,
      plan: row.plan as FourWeekPlan,
      progress: (row.progress ?? null) as Record<string, boolean> | null,
      retest_at: row.retest_at as string,
    });
    return shaped ? [shaped] : [];
  });

  return { timeZone: family.time_zone as string | null, children, reportTokens, plans };
}
