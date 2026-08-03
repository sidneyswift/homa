import { supabase } from "./supabase";
import {
  MutationReceiptError,
  requireMutationReceipt,
  requireReceiptValue,
} from "./mutation-receipt";

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
  /** When present, use the server-bound native mutation wrapper. */
  captureLoopId?: string;
  childId: string;
  subjectId: string;
  week: number;
  activityIndex: number;
  planRevision: number;
  expectedText: string;
  scheduledDate: string;
}

interface ScheduleReceipt {
  status: "applied" | "conflict";
  reason: string | null;
  family_id: string | null;
  plan_id: string | null;
  plan_revision: number | null;
  scheduled_date: string | null;
  activity_text: string | null;
  schedule_id: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function parseScheduleReceipt(raw: unknown): ScheduleReceipt | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const status = value.status === "applied" || value.status === "conflict"
    ? value.status
    : null;
  const numberValue = value.plan_revision === null
    ? null
    : typeof value.plan_revision === "number" && Number.isInteger(value.plan_revision)
      ? value.plan_revision
      : typeof value.plan_revision === "string" && /^\d+$/u.test(value.plan_revision)
        ? Number(value.plan_revision)
        : undefined;
  const nullableString = (candidate: unknown): string | null | undefined =>
    candidate === null || typeof candidate === "string" ? candidate : undefined;
  const nullableUuid = (candidate: unknown): string | null | undefined =>
    candidate === null || (typeof candidate === "string" && UUID_RE.test(candidate))
      ? candidate
      : undefined;
  const reason = nullableString(value.reason);
  const familyId = nullableUuid(value.family_id);
  const planId = nullableUuid(value.plan_id);
  const scheduledDate = nullableString(value.scheduled_date);
  const activityText = nullableString(value.activity_text);
  const scheduleId = nullableUuid(value.schedule_id);
  if (
    status === null
    || reason === undefined
    || familyId === undefined
    || planId === undefined
    || numberValue === undefined
    || scheduledDate === undefined
    || activityText === undefined
    || scheduleId === undefined
  ) return null;
  return {
    status,
    reason,
    family_id: familyId,
    plan_id: planId,
    plan_revision: numberValue,
    scheduled_date: scheduledDate,
    activity_text: activityText,
    schedule_id: scheduleId,
  };
}

export async function scheduleActivity(
  input: ScheduleActivityInput,
): Promise<{ id: string; scheduledDate: string }> {
  const result = await supabase.rpc(
    input.captureLoopId ? "schedule_plan_activity_native_v1" : "schedule_plan_activity_v2",
    input.captureLoopId
      ? {
          target_loop_id: input.captureLoopId,
          target_child_id: input.childId,
          target_subject_id: input.subjectId,
          target_week: input.week,
          target_activity_index: input.activityIndex,
          target_scheduled_date: input.scheduledDate,
          target_expected_text: input.expectedText,
          target_plan_revision: input.planRevision,
          target_schedule_id: null,
        }
      : {
          target_child_id: input.childId,
          target_subject_id: input.subjectId,
          target_week: input.week,
          target_activity_index: input.activityIndex,
          target_scheduled_date: input.scheduledDate,
          target_expected_text: input.expectedText,
          target_plan_revision: input.planRevision,
          target_schedule_id: null,
        },
  )
    .single();
  const rawReceipt = requireMutationReceipt("schedule_plan_activity", result);
  const receipt = parseScheduleReceipt(rawReceipt);
  if (!receipt) {
    throw new MutationReceiptError(
      "schedule_plan_activity",
      "contradictory_receipt",
      "schedule receipt shape was invalid",
    );
  }
  if (receipt.status === "conflict") {
    throw new MutationReceiptError(
      "schedule_plan_activity",
      "contradictory_receipt",
      receipt.reason ?? "the plan changed before the date was saved",
    );
  }
  requireReceiptValue(
    "schedule_plan_activity",
    receipt.family_id === input.familyId
      && receipt.plan_id !== null
      && receipt.plan_revision === input.planRevision
      && receipt.activity_text === input.expectedText
      && receipt.scheduled_date === input.scheduledDate
      && receipt.schedule_id !== null,
  );
  return { id: receipt.schedule_id!, scheduledDate: receipt.scheduled_date! };
}

export async function unscheduleActivity(
  childId: string,
  subjectId: string,
  week: number,
  activityIndex: number,
): Promise<{ id: string }> {
  const result = await supabase
    .from("plan_activity_schedule")
    .delete()
    .eq("child_id", childId)
    .eq("subject_id", subjectId)
    .eq("week", week)
    .eq("activity_index", activityIndex)
    .select("id")
    .maybeSingle();
  return requireMutationReceipt("unschedule_plan_activity", result);
}
