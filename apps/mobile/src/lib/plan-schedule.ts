import { supabase } from "./supabase";

/**
 * Real dates for four-week-plan activities, ported from
 * supabase/migrations/20260726140000_plan_activity_schedule.sql. One row
 * per (child, subject, week, activity index); rescheduling is an upsert
 * on that natural key, mirroring apps/web/lib/plan-schedule.ts's
 * schedulePlanActivityCaller, which does the exact same upsert under the
 * caller's own RLS-scoped client (confirmed: this table has full
 * insert/update/delete policies for authenticated family members, not a
 * server-only write path).
 */

export interface PlanActivityScheduleRecord {
  id: string;
  family_id: string;
  child_id: string;
  subject_id: string;
  week: number;
  activity_index: number;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
}

export async function getScheduledActivities(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<PlanActivityScheduleRecord[]> {
  const { data, error } = await supabase
    .from("plan_activity_schedule")
    .select("id, family_id, child_id, subject_id, week, activity_index, scheduled_date, created_at, updated_at")
    .eq("family_id", familyId)
    .gte("scheduled_date", fromDate)
    .lte("scheduled_date", toDate)
    .order("scheduled_date", { ascending: true });
  if (error) throw new Error(`plan schedule read failed: ${error.message}`);
  return (data ?? []) as PlanActivityScheduleRecord[];
}

export interface ScheduleActivityInput {
  familyId: string;
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  scheduledDate: string;
}

export async function scheduleActivity(input: ScheduleActivityInput): Promise<{ error: string | null }> {
  const { error } = await supabase.from("plan_activity_schedule").upsert(
    {
      family_id: input.familyId,
      child_id: input.childId,
      subject_id: input.subjectId,
      week: input.week,
      activity_index: input.activityIndex,
      scheduled_date: input.scheduledDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "family_id,child_id,subject_id,week,activity_index" },
  );
  return { error: error ? error.message : null };
}

export async function unscheduleActivity(
  childId: string,
  subjectId: string,
  week: number,
  activityIndex: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("plan_activity_schedule")
    .delete()
    .eq("child_id", childId)
    .eq("subject_id", subjectId)
    .eq("week", week)
    .eq("activity_index", activityIndex);
  return { error: error ? error.message : null };
}
