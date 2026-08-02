import {
  SCHEDULE_COLUMNS,
  toScheduleRow,
  type PlanActivityScheduleRow,
  type RawScheduleRow,
} from "./plan-schedule";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * The Planner page's plan_activity_schedule read, under the
 * caller's own RLS session (the same posture as lib/hours.ts and
 * lib/family-events-read.ts).
 *
 * Deliberately its own file, separate from lib/plan-schedule.ts: see
 * that file's own comment (createSupabaseServerClient pulls in
 * next/headers, which eve's standalone tool build cannot resolve). No
 * agent tool may import this file.
 */
export async function getScheduledActivitiesForFamily(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<PlanActivityScheduleRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plan_activity_schedule")
    .select(SCHEDULE_COLUMNS)
    .eq("family_id", familyId)
    .gte("scheduled_date", fromDate)
    .lte("scheduled_date", toDate)
    .order("scheduled_date", { ascending: true });
  if (error) throw new Error(`plan_activity_schedule read failed: ${error.message}`);
  return (data ?? []).map((row) => toScheduleRow(row as RawScheduleRow));
}
