"use server";

import { revalidatePath } from "next/cache";

import { getMyFamily } from "../../../lib/family";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

interface StatusReceipt {
  result: "applied" | "conflict";
  reason: string | null;
  family_id: string;
  activity_id: string;
  activity_status: "planned" | "completed";
  updated_at: string;
  changed: boolean;
}

export async function setPlannerLearningActivityStatusAction(input: {
  activityId: string;
  expectedStatus: "planned" | "completed";
  status: "planned" | "completed";
}): Promise<
  | { ok: true; status: "planned" | "completed"; changed: boolean }
  | { ok: false; reason: string }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "set_planner_learning_activity_status",
    {
      target_activity_id: input.activityId,
      target_expected_status: input.expectedStatus,
      target_status: input.status,
      target_source_channel: "web",
    },
  );
  if (error) return { ok: false, reason: error.message };
  const receipt = (data as StatusReceipt[] | null)?.[0];
  if (!receipt) return { ok: false, reason: "Planner did not return a save receipt." };
  if (receipt.result === "conflict") {
    return {
      ok: false,
      reason: "That change didn't save. Nothing was overwritten. Planner refreshed; try again.",
    };
  }
  return { ok: true, status: receipt.activity_status, changed: receipt.changed };
}

interface DetailsReceipt {
  result: "applied";
  activity_id: string;
  family_id: string;
  title: string;
  note: string | null;
  updated_at: string;
}

export async function updatePlannerLearningActivityDetailsAction(input: {
  activityId: string;
  title: string;
  note: string;
}): Promise<
  | { ok: true; title: string; note: string | null }
  | { ok: false; reason: string }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "update_planner_learning_activity_details",
    {
      target_activity_id: input.activityId,
      target_title: input.title,
      target_note: input.note,
    },
  );
  if (error) return { ok: false, reason: error.message };
  const receipt = (data as DetailsReceipt[] | null)?.[0];
  if (!receipt) return { ok: false, reason: "Planner did not return a save receipt." };
  return { ok: true, title: receipt.title, note: receipt.note };
}

interface DeleteReceipt {
  result: "applied";
  activity_id: string;
  family_id: string;
}

/**
 * Delete a chat-logged Planner item (Carolyng feedback, 2026-08-27): one
 * of the two duplicate-entry sources she asked for a delete button on.
 * Direct table delete stays revoked from authenticated (see the owning
 * migration), so this is the only door; the RPC also removes any Hours
 * row this activity logged, so deleting a duplicate never leaves an
 * orphaned Hours entry behind for her to find and clean up separately.
 */
export async function deletePlannerLearningActivityAction(
  activityId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("delete_planner_learning_activity", {
    target_activity_id: activityId,
  });
  if (error) return { ok: false, reason: error.message };
  const receipt = (data as DeleteReceipt[] | null)?.[0];
  if (!receipt) return { ok: false, reason: "Planner did not return a delete receipt." };
  revalidatePath("/app/planner");
  revalidatePath("/app/hours");
  return { ok: true };
}

/**
 * Delete the OTHER duplicate source: a generated-plan activity's
 * placement on a specific calendar day. This removes only the
 * plan_activity_schedule row (RLS already grants authenticated delete
 * there, same posture as hours_log), so the activity stays exactly as
 * it is in the underlying four-week plan and remains checkable; it just
 * stops appearing twice on the same day. Full removal from the plan
 * text itself is a bigger, separately-scoped change (index remapping
 * into plan_activity_schedule is a documented known limitation, see
 * that migration's header) and is not what this button does.
 */
export async function deleteScheduledPlanActivityAction(input: {
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const family = await getMyFamily();
  if (!family) return { ok: false, reason: "Set up your family first." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("plan_activity_schedule")
    .delete()
    .eq("family_id", family.id)
    .eq("child_id", input.childId)
    .eq("subject_id", input.subjectId)
    .eq("week", input.week)
    .eq("activity_index", input.activityIndex);
  if (error) return { ok: false, reason: "That didn't come off the day. Try again in a minute." };
  revalidatePath("/app/planner");
  return { ok: true };
}
