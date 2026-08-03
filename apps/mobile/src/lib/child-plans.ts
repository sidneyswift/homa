import type { FourWeekPlan } from "@homa/core";

import {
  executePlanActivityCheck,
  type PlanActivityCheckInput,
  type PlanActivityCheckOutcome,
} from "./plan-check-mutation";
import { supabase } from "./supabase";

/**
 * Four-week plan reads plus the stale-safe atomic check operation. A
 * positional key alone is not identity after a plan rebuild, so every
 * write also proves the exact activity text and plan revision the parent
 * saw. The RPC returns the complete authoritative progress snapshot and
 * its own monotonic revision in the same locked operation.
 */

export interface ChildPlanRecord {
  id: string;
  child_id: string;
  subject_id: string;
  plan: FourWeekPlan;
  progress: Record<string, boolean>;
  retest_at: string | null;
  plan_revision: number;
  progress_revision: number;
}

export async function getChildPlans(childId: string): Promise<ChildPlanRecord[]> {
  const { data, error } = await supabase
    .from("child_plans")
    .select("id, child_id, subject_id, plan, progress, retest_at, plan_revision, progress_revision")
    .eq("child_id", childId);
  if (error) throw new Error(`plan read failed: ${error.message}`);
  return (data ?? []) as ChildPlanRecord[];
}

export async function getFamilyChildPlans(childIds: string[]): Promise<ChildPlanRecord[]> {
  if (childIds.length === 0) return [];
  const { data, error } = await supabase
    .from("child_plans")
    .select("id, child_id, subject_id, plan, progress, retest_at, plan_revision, progress_revision")
    .in("child_id", childIds);
  if (error) throw new Error(`plan read failed: ${error.message}`);
  return (data ?? []) as ChildPlanRecord[];
}

export async function toggleActivityCheck(
  input: PlanActivityCheckInput,
): Promise<PlanActivityCheckOutcome> {
  return executePlanActivityCheck(
    (args) => supabase.rpc("set_plan_activity_check_v2", args).single(),
    input,
  );
}
