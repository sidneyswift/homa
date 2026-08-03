import { supabase } from "./supabase";

export type PlannerLearningStatus = "planned" | "completed";

export interface PlannerLearningActivityRecord {
  id: string;
  familyId: string;
  title: string;
  subject: string;
  activityDate: string;
  status: PlannerLearningStatus;
  durationMinutes: number | null;
  note: string | null;
  sourceQuote: string;
  childIds: string[];
  hoursEntryIds: string[];
}

interface RawPlannerLearningActivity {
  id: string;
  family_id: string;
  title: string;
  subject: string;
  activity_date: string;
  status: string;
  duration_minutes: number | null;
  note: string | null;
  source_quote: string;
  planner_learning_activity_children: { child_id: string }[] | null;
  planner_learning_activity_hours: { hours_entry_id: string }[] | null;
}

function normalize(row: RawPlannerLearningActivity): PlannerLearningActivityRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    title: row.title,
    subject: row.subject,
    activityDate: row.activity_date,
    status: row.status === "completed" ? "completed" : "planned",
    durationMinutes: row.duration_minutes,
    note: row.note,
    sourceQuote: row.source_quote,
    childIds: (row.planner_learning_activity_children ?? []).map(
      (link) => link.child_id,
    ),
    hoursEntryIds: (row.planner_learning_activity_hours ?? []).map(
      (link) => link.hours_entry_id,
    ),
  };
}

export async function getPlannerLearningActivities(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<PlannerLearningActivityRecord[]> {
  const { data, error } = await supabase
    .from("planner_learning_activities")
    .select(`
      id, family_id, title, subject, activity_date, status, duration_minutes,
      note, source_quote, planner_learning_activity_children(child_id),
      planner_learning_activity_hours(hours_entry_id)
    `)
    .eq("family_id", familyId)
    .gte("activity_date", fromDate)
    .lte("activity_date", toDate)
    .order("activity_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(`Planner learning activity read failed: ${error.message}`);
  return (data ?? []).map((row) => normalize(row as RawPlannerLearningActivity));
}

export async function setPlannerLearningActivityStatus(input: {
  activityId: string;
  expectedStatus: PlannerLearningStatus;
  status: PlannerLearningStatus;
}): Promise<{ status: PlannerLearningStatus; changed: boolean }> {
  const { data, error } = await supabase.rpc(
    "set_planner_learning_activity_status",
    {
      target_activity_id: input.activityId,
      target_expected_status: input.expectedStatus,
      target_status: input.status,
      target_source_channel: "mobile",
    },
  );
  if (error) throw new Error(`Planner activity update failed: ${error.message}`);
  const receipt = (data as {
    result: "applied" | "conflict";
    reason: string | null;
    activity_status: PlannerLearningStatus;
    changed: boolean;
  }[] | null)?.[0];
  if (!receipt) throw new Error("Planner did not return a save receipt.");
  if (receipt.result === "conflict") {
    throw new Error(
      "That change didn't save. Nothing was overwritten. Pull down to refresh Planner, then try again.",
    );
  }
  return { status: receipt.activity_status, changed: receipt.changed };
}
