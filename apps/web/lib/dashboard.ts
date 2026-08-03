import { getMapItem, type FourWeekPlan, type MapScores } from "@homa/core";

import type { ArchivedScoring } from "./map/trajectory-eras";
import {
  attachPlanSourceRows,
  type PlanSourceDisplayRow,
} from "./map/plan-source-links";
import { dashboardPlanFromRow, type DashboardPlan } from "./plan-week";
import { createSupabaseServerClient } from "./supabase/server";

export { currentWeekIndex, type DashboardPlan } from "./plan-week";

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

export async function getPlansForChildren(childIds: string[]): Promise<DashboardPlan[]> {
  if (childIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const [planResult, sourceResult] = await Promise.all([
    supabase
      .from("child_plans")
      .select(
        "child_id, subject_id, plan, progress, retest_at, plan_revision, progress_revision",
      )
      .in("child_id", childIds),
    supabase
      .from("family_asset_plan_links")
      .select(
        "child_id, subject_id, week, activity_index, activity_text, asset_id, source_title",
      )
      .in("child_id", childIds),
  ]);
  if (planResult.error) {
    throw new Error(`child_plans read failed: ${planResult.error.message}`);
  }
  if (sourceResult.error) {
    throw new Error(
      `family asset plan links read failed: ${sourceResult.error.message}`,
    );
  }
  const plans = (planResult.data ?? []).flatMap((row) => {
    const shaped = dashboardPlanFromRow({
      child_id: row.child_id as string,
      subject_id: row.subject_id as string,
      plan: row.plan as FourWeekPlan,
      progress: (row.progress ?? null) as Record<string, boolean> | null,
      retest_at: row.retest_at as string,
      plan_revision: row.plan_revision as number,
      progress_revision: row.progress_revision as number,
    });
    return shaped ? [shaped] : [];
  });
  return attachPlanSourceRows(
    plans,
    (sourceResult.data ?? []) as PlanSourceDisplayRow[],
  );
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
