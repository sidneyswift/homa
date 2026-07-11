import {
  ageInMonths,
  getMapItem,
  isInScoredRange,
  type FourWeekPlan,
  type MapScores,
  type PlanWeek,
} from "@homa/core";

import type { ChildRecord } from "./family";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * Server-side reads shared by the /app pages (the report tab, kid pages,
 * planner, the sidebar's up-next rail). Everything here runs under the
 * caller's RLS context (publishable key + session JWT), so every row is
 * family-scoped by the database itself. No write paths: these surfaces
 * only render what the questionnaire, plans, and calls already produced.
 * Display law applies downstream: these rows carry positions and dates,
 * never invented streaks or hours.
 */

export interface DashboardReport {
  childId: string;
  /** The permanent report URL token. Linking it here is the sanctioned
   * pattern: /app is session-scoped, so only the parent's own browser
   * ever sees it (see report-view's sibling-token note). */
  token: string | null;
  scores: MapScores;
  generatedAt: string;
  /** Prior scorings, newest first, for honest movement lines. */
  history: { scores: MapScores; generated_at: string }[];
}

export async function getReportsForChildren(
  childIds: string[],
): Promise<Map<string, DashboardReport>> {
  if (childIds.length === 0) return new Map();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("child_reports")
    .select("child_id, token, scores, generated_at, history")
    .in("child_id", childIds);
  if (error) throw new Error(`child_reports read failed: ${error.message}`);
  return new Map(
    (data ?? []).map((row) => [
      row.child_id as string,
      {
        childId: row.child_id as string,
        token: (row.token as string | null) ?? null,
        scores: row.scores as MapScores,
        generatedAt: row.generated_at as string,
        history: (row.history ?? []) as { scores: MapScores; generated_at: string }[],
      },
    ]),
  );
}

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
export function planStartMs(plan: DashboardPlan): number {
  return new Date(plan.retestAt).getTime() - 28 * 24 * 60 * 60 * 1000;
}

/** Which of the four weeks the family is living right now (0-based,
 * clamped so a plan past its retest still shows week 4, never crashes). */
export function currentWeekIndex(plan: DashboardPlan, nowMs: number): number {
  const elapsedWeeks = Math.floor((nowMs - planStartMs(plan)) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(elapsedWeeks, 0), plan.weeks.length - 1);
}

export async function getPlansForChildren(childIds: string[]): Promise<DashboardPlan[]> {
  if (childIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("child_plans")
    .select("child_id, subject_id, plan, progress, retest_at")
    .in("child_id", childIds);
  if (error) throw new Error(`child_plans read failed: ${error.message}`);
  return (data ?? []).map((row) => {
    const plan = row.plan as FourWeekPlan;
    const progress = (row.progress ?? {}) as Record<string, boolean>;
    return {
      childId: row.child_id as string,
      subjectId: row.subject_id as string,
      done: Object.values(progress).filter(Boolean).length,
      total: plan.weeks.reduce((sum, week) => sum + week.activities.length, 0),
      retestAt: row.retest_at as string,
      weeks: plan.weeks,
      progress,
    };
  });
}

export interface RecentWin {
  childId: string;
  itemId: string;
  /** The confirmed skill, in the bank's own reviewed words. */
  statement: string;
  answeredAt: string;
}

/**
 * The family's recent wins: dated "easily" answers, newest first. Real
 * observations the parent herself confirmed, so the wins card never has
 * to invent a milestone. Positive-only by construction.
 */
export async function getRecentWins(childIds: string[], limit = 6): Promise<RecentWin[]> {
  if (childIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("child_answers")
    .select("child_id, question_id, answered_at")
    .in("child_id", childIds)
    .eq("answer", "easily")
    .order("answered_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`child_answers read failed: ${error.message}`);
  const wins: RecentWin[] = [];
  for (const row of data ?? []) {
    const found = getMapItem(row.question_id as string);
    if (!found) continue;
    wins.push({
      childId: row.child_id as string,
      itemId: found.item.id,
      statement: found.item.statement,
      answeredAt: row.answered_at as string,
    });
  }
  return wins;
}

export interface UpNextItem {
  key: string;
  label: string;
  sub: string | null;
  dot: "sage" | "clay" | "stone";
  href: string | null;
}

/**
 * The sidebar's "up next" rail, derived from real state only: an in-range
 * kid whose checklist is waiting, a month plan whose four weeks are up,
 * a curriculum still being built from a call. No planner exists yet, so
 * nothing here pretends to be a schedule. Falls back to the chat offer.
 */
export function buildUpNextItems(input: {
  children: ChildRecord[];
  reports: Map<string, DashboardReport>;
  plans: DashboardPlan[];
  pendingCurriculumChildIds: Set<string>;
}): UpNextItem[] {
  const items: UpNextItem[] = [];
  const nameById = new Map(input.children.map((child) => [child.id, child.name]));
  const now = Date.now();

  for (const child of input.children) {
    const months = ageInMonths(child.birth_month);
    if (isInScoredRange(months) && !input.reports.has(child.id)) {
      items.push({
        key: `checklist-${child.id}`,
        label: `${child.name}'s checklist`,
        sub: "about 5 minutes",
        dot: "sage",
        href: "/onboarding",
      });
    }
  }

  for (const plan of input.plans) {
    if (new Date(plan.retestAt).getTime() > now) continue;
    const token = input.reports.get(plan.childId)?.token;
    const name = nameById.get(plan.childId);
    items.push({
      key: `retest-${plan.childId}-${plan.subjectId}`,
      label: name ? `Re-check ${name}'s month` : "Re-check the month",
      sub: "see what moved",
      dot: "clay",
      href: token ? `/onboarding/r/${token}/plan/${plan.subjectId}` : null,
    });
  }

  for (const childId of input.pendingCurriculumChildIds) {
    const name = nameById.get(childId);
    items.push({
      key: `curriculum-${childId}`,
      label: name ? `${name}'s curriculum is on its way` : "A curriculum is on its way",
      sub: "from your call with Homa",
      dot: "stone",
      href: null,
    });
  }

  if (items.length === 0) {
    items.push({
      key: "chat",
      label: "Talk to Homa about your week",
      sub: null,
      dot: "sage",
      href: "/app",
    });
  }
  return items.slice(0, 3);
}
