"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMyFamily } from "../../../lib/family";
import { hoursMutationError } from "../../../lib/hours-edit";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function savePlannerLearningActivityAction(input: {
  activityId: string;
  expectedUpdatedAt: string;
  title: string;
  note: string;
  durationMinutes: number | null;
}): Promise<
  | { ok: true; title: string; note: string | null; durationMinutes: number | null; status: "planned" | "completed"; updatedAt: string }
  | { ok: false; reason: string }
> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_planner_learning_activity_record", {
      target_activity_id: input.activityId,
      target_expected_updated_at: input.expectedUpdatedAt,
      target_title: input.title,
      target_note: input.note,
      target_duration_minutes: input.durationMinutes,
    });
    if (error) return { ok: false, reason: "That change couldn't be confirmed. Reopen the activity to check before trying again." };
    const failure = hoursMutationError(data, "planner");
    if (failure) return { ok: false, reason: failure };
    const parsed = z.object({
      result: z.literal("applied"), title: z.string(), note: z.string().nullable(),
      durationMinutes: z.number().int().min(1).max(600).nullable(),
      status: z.enum(["planned", "completed"]), updatedAt: z.string(),
    }).safeParse(data);
    if (!parsed.success) return { ok: false, reason: "The change couldn't be confirmed. Reopen the activity to check." };
    revalidatePath("/app/planner");
    revalidatePath("/app/hours");
    return { ok: true, ...parsed.data };
  } catch {
    return { ok: false, reason: "That change couldn't be confirmed. Check your connection and reopen the activity." };
  }
}

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

interface TimeReceipt {
  result: "applied" | "conflict";
  reason: string | null;
  activity_id: string;
  family_id: string;
  activity_status: "planned" | "completed";
  duration_minutes: number | null;
  hours_entry_ids: string[];
  updated_at: string;
}

/**
 * Planner: let a parent add or edit an activity's reported time herself
 * (Carolyng feedback, 2026-09-02): "I would like there to be the option
 * for me to add the reported time manually." The web checkbox only ever
 * flips planned/completed and never asks for a duration, so a
 * web-completed item otherwise logs zero Hours. Setting a duration here
 * also marks a still-planned activity completed, in the RPC; passing
 * null clears the reported time (and its linked Hours rows) without
 * touching status.
 */
export async function setPlannerLearningActivityTimeAction(input: {
  activityId: string;
  durationMinutes: number | null;
}): Promise<
  | { ok: true; status: "planned" | "completed"; durationMinutes: number | null }
  | { ok: false; reason: string }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_planner_learning_activity_time", {
    target_activity_id: input.activityId,
    target_duration_minutes: input.durationMinutes,
  });
  if (error) return { ok: false, reason: error.message };
  const receipt = (data as TimeReceipt[] | null)?.[0];
  if (!receipt) return { ok: false, reason: "Planner did not return a save receipt." };
  if (receipt.result === "conflict") {
    return {
      ok: false,
      reason: "That time couldn't be saved: a block just like it is already on the record for that day.",
    };
  }
  revalidatePath("/app/planner");
  revalidatePath("/app/hours");
  return { ok: true, status: receipt.activity_status, durationMinutes: receipt.duration_minutes };
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
