import {
  PLANNER_LEARNING_SOURCE_CHANNELS,
  PLANNER_LEARNING_STATUSES,
  type PlannerLearningActivity,
  type PlannerLearningSourceChannel,
  type PlannerLearningStatus,
} from "./planner-learning-activities";
import { isHoursSubject } from "./hours-model";
import { createSupabaseServerClient } from "./supabase/server";

const MAX_VISIBLE_ACTIVITIES = 300;

interface RawPlannerLearningActivity {
  id: string;
  family_id: string;
  title: string;
  subject: string;
  activity_date: string;
  status: string;
  duration_minutes: number | null;
  note: string | null;
  source_channel: string;
  source_quote: string;
  source_message_id: string | null;
  completion_source_channel: string | null;
  completion_source_quote: string | null;
  completion_source_message_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  planner_learning_activity_children: Array<{ child_id: string }> | null;
  planner_learning_activity_hours: Array<{ hours_entry_id: string }> | null;
}

function plannerStatus(value: string): PlannerLearningStatus {
  return (PLANNER_LEARNING_STATUSES as readonly string[]).includes(value)
    ? (value as PlannerLearningStatus)
    : "planned";
}

function plannerSource(value: string | null): PlannerLearningSourceChannel | null {
  if (value === null) return null;
  return (PLANNER_LEARNING_SOURCE_CHANNELS as readonly string[]).includes(value)
    ? (value as PlannerLearningSourceChannel)
    : "other";
}

function normalize(row: RawPlannerLearningActivity): PlannerLearningActivity {
  return {
    id: row.id,
    familyId: row.family_id,
    title: row.title,
    subject: isHoursSubject(row.subject) ? row.subject : "other",
    activityDate: row.activity_date,
    status: plannerStatus(row.status),
    durationMinutes: row.duration_minutes,
    note: row.note,
    sourceChannel: plannerSource(row.source_channel) ?? "other",
    sourceQuote: row.source_quote,
    sourceMessageId: row.source_message_id,
    completionSourceChannel: plannerSource(row.completion_source_channel),
    completionSourceQuote: row.completion_source_quote,
    completionSourceMessageId: row.completion_source_message_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    childIds: (row.planner_learning_activity_children ?? []).map(
      (link) => link.child_id,
    ),
    hoursEntryIds: (row.planner_learning_activity_hours ?? []).map(
      (link) => link.hours_entry_id,
    ),
  };
}

/**
 * Next-only caller read. Agent tools use the pinned reader in the sibling
 * module so Eve's standalone build never pulls in next/headers.
 */
export async function getPlannerLearningActivitiesForFamily(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<PlannerLearningActivity[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("planner_learning_activities")
    .select(`
      id, family_id, title, subject, activity_date, status, duration_minutes,
      note, source_channel, source_quote, source_message_id,
      completion_source_channel, completion_source_quote,
      completion_source_message_id, completed_at, created_at, updated_at,
      planner_learning_activity_children(child_id),
      planner_learning_activity_hours(hours_entry_id)
    `)
    .eq("family_id", familyId)
    .gte("activity_date", fromDate)
    .lte("activity_date", toDate)
    .order("activity_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_VISIBLE_ACTIVITIES);
  if (error) {
    throw new Error(`planner learning activity read failed: ${error.message}`);
  }
  return (data ?? []).map((row) => normalize(row as RawPlannerLearningActivity));
}
