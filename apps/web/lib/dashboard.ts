import {
  getMapItem,
  type FourWeekPlan,
  type MapScores,
  type PlanWeek,
} from "@homa/core";

import type { ArchivedScoring } from "./map/trajectory-eras";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * Server-side reads shared by the /app pages (the report tab, kid pages,
 * planner). Everything here runs under the caller's RLS context
 * (publishable key + session JWT), so every row is family-scoped by the
 * database itself. No write paths: these surfaces only render what the
 * questionnaire, plans, and calls already produced. Display law applies
 * downstream: these rows carry positions and dates, never invented
 * streaks or hours.
 */

export interface DashboardReport {
  childId: string;
  /** The permanent report URL token. Linking it here is the sanctioned
   * pattern: /app is session-scoped, so only the parent's own browser
   * ever sees it (see report-view's sibling-token note). */
  token: string | null;
  scores: MapScores;
  generatedAt: string;
  /** Prior scorings, newest first, for honest movement lines. Entries
   * written after migration #78 also carry their measurement-basis
   * stamps, which the trajectory chart reads. */
  history: ArchivedScoring[];
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
        history: (row.history ?? []) as ArchivedScoring[],
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
function planStartMs(plan: DashboardPlan): number {
  return new Date(plan.retestAt).getTime() - 28 * 24 * 60 * 60 * 1000;
}

/** Which of the four weeks the family is living right now (0-based,
 * clamped so a plan past its retest still shows week 4, never crashes). */
export function currentWeekIndex(plan: DashboardPlan, nowMs: number): number {
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

export async function getPlansForChildren(childIds: string[]): Promise<DashboardPlan[]> {
  if (childIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("child_plans")
    .select("child_id, subject_id, plan, progress, retest_at")
    .in("child_id", childIds);
  if (error) throw new Error(`child_plans read failed: ${error.message}`);
  return (data ?? []).flatMap((row) => {
    const plan = row.plan as FourWeekPlan;
    const weeks = Array.isArray(plan.weeks) ? plan.weeks.filter(validPlanWeek) : [];
    if (weeks.length === 0) return [];
    const progress = (row.progress ?? {}) as Record<string, boolean>;
    return [{
      childId: row.child_id as string,
      subjectId: row.subject_id as string,
      done: Object.values(progress).filter(Boolean).length,
      total: weeks.reduce((sum, week) => sum + week.activities.length, 0),
      retestAt: row.retest_at as string,
      weeks,
      progress,
    }];
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
