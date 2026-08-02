import { supabase } from "./supabase";
import {
  requireMutationReceipt,
  requireReceiptValue,
} from "./mutation-receipt";

export interface FamilyEventRecurrence {
  frequency: "weekly";
  interval: number;
  weekdays: number[];
  until: string | null;
}

/**
 * Homa's own family calendar (appointments, trips), never an external
 * sync. Ported from supabase/migrations/20260726130000_family_events.sql:
 * a genuinely writable table, full insert/update/delete RLS policies for
 * authenticated family members (unlike child_progress_live's read-only
 * posture), the same pattern apps/web/app/app/calendar/actions.ts's
 * server actions use under the hood. Direct writes here are as safe as
 * anywhere else in this app: RLS re-checks family membership and, for
 * writes, that child_id (if set) really belongs to that family.
 */

export interface FamilyEventRecord {
  id: string;
  family_id: string;
  /** Null means a whole-family event. */
  child_id: string | null;
  title: string;
  starts_on: string;
  ends_on: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  recurrence_rule?: FamilyEventRecurrence | null;
  created_at: string;
}

export interface FamilyEventInput {
  childId: string | null;
  title: string;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  recurrence?: FamilyEventRecurrence | null;
}

export async function getFamilyEvents(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<FamilyEventRecord[]> {
  const { data, error } = await supabase
    .from("family_events")
    .select("id, family_id, child_id, title, starts_on, ends_on, start_time, end_time, note, recurrence_rule, created_at")
    .eq("family_id", familyId)
    .lte("starts_on", toDate)
    .or(`ends_on.gte.${fromDate},recurrence_rule.not.is.null`)
    .order("starts_on", { ascending: true });
  if (error) throw new Error(`family events read failed: ${error.message}`);
  return (data ?? []) as FamilyEventRecord[];
}

export async function createFamilyEvent(
  eventId: string,
  familyId: string,
  input: FamilyEventInput,
): Promise<{ id: string }> {
  const result = await supabase
    .from("family_events")
    .upsert(
      {
        id: eventId,
        family_id: familyId,
        child_id: input.childId,
        title: input.title.trim(),
        starts_on: input.startsOn,
        ends_on: input.endsOn,
        start_time: input.startTime,
        end_time: input.endTime,
        note: input.note?.trim() || null,
        recurrence_rule: input.recurrence ?? null,
      },
      { onConflict: "id" },
    )
    .select("id, family_id")
    .single();
  const receipt = requireMutationReceipt("create_family_event", result);
  requireReceiptValue(
    "create_family_event",
    receipt.id === eventId && receipt.family_id === familyId,
  );
  return { id: receipt.id };
}

export async function updateFamilyEvent(
  eventId: string,
  input: FamilyEventInput,
): Promise<{ id: string }> {
  const result = await supabase
    .from("family_events")
    .update({
      child_id: input.childId,
      title: input.title.trim(),
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      start_time: input.startTime,
      end_time: input.endTime,
      note: input.note?.trim() || null,
      recurrence_rule: input.recurrence ?? null,
    })
    .eq("id", eventId)
    .select("id")
    .maybeSingle();
  return requireMutationReceipt("update_family_event", result);
}

export async function deleteFamilyEvent(eventId: string): Promise<{ id: string }> {
  const result = await supabase
    .from("family_events")
    .delete()
    .eq("id", eventId)
    .select("id")
    .maybeSingle();
  return requireMutationReceipt("delete_family_event", result);
}
