"use server";

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
