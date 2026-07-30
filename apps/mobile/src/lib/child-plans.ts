import type { FourWeekPlan } from "@homa/core";

import { supabase } from "./supabase";

/**
 * Four-week plan reads plus the atomic check-off toggle, ported from
 * apps/web/lib/map/store.ts's plan reads and
 * supabase/migrations/20260729160000_toggle_plan_activity_check.sql.
 *
 * Check-offs on web go through a whole-map-replace POST
 * (apps/web/app/api/map/plan/progress/route.ts): the client sends its
 * entire locally-believed progress object and the server overwrites the
 * whole column, so two clients toggling near-simultaneously can clobber
 * each other. toggle_plan_activity_check sets exactly one key atomically
 * instead, so mobile's writes are safe alongside web's without needing
 * web to change anything.
 */

export interface ChildPlanRecord {
  id: string;
  child_id: string;
  subject_id: string;
  plan: FourWeekPlan;
  progress: Record<string, boolean>;
  retest_at: string | null;
}

export async function getChildPlans(childId: string): Promise<ChildPlanRecord[]> {
  const { data, error } = await supabase
    .from("child_plans")
    .select("id, child_id, subject_id, plan, progress, retest_at")
    .eq("child_id", childId);
  if (error) throw new Error(`plan read failed: ${error.message}`);
  return (data ?? []) as ChildPlanRecord[];
}

export async function getFamilyChildPlans(childIds: string[]): Promise<ChildPlanRecord[]> {
  if (childIds.length === 0) return [];
  const { data, error } = await supabase
    .from("child_plans")
    .select("id, child_id, subject_id, plan, progress, retest_at")
    .in("child_id", childIds);
  if (error) throw new Error(`plan read failed: ${error.message}`);
  return (data ?? []) as ChildPlanRecord[];
}

export async function toggleActivityCheck(
  childId: string,
  subjectId: string,
  week: number,
  activityIndex: number,
  done: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("toggle_plan_activity_check", {
    target_child_id: childId,
    target_subject_id: subjectId,
    target_week: week,
    target_activity_index: activityIndex,
    target_done: done,
  });
  return { error: error ? error.message : null };
}
