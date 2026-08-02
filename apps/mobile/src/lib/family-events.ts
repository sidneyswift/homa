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
  /** Empty means the whole family. New clients use this multi-child audience;
   * child_id remains the compatibility marker for older builds. */
  child_ids?: string[];
  title: string;
  starts_on: string;
  ends_on: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  recurrence_rule?: FamilyEventRecurrence | null;
  created_at: string;
  /** Canonical series dates carried by an expanded occurrence. */
  series_starts_on?: string;
  series_ends_on?: string;
  occurrence_key?: string;
}

export interface FamilyEventInput {
  childId?: string | null;
  childIds?: string[];
  title: string;
  startsOn: string;
  endsOn: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  recurrence?: FamilyEventRecurrence | null;
}

type RawFamilyEventRecord = FamilyEventRecord;

export function familyEventChildIds(
  event: Pick<FamilyEventRecord, "child_id" | "child_ids">,
): string[] {
  if (event.child_id === null) return [];
  const linked = event.child_ids ?? [];
  return linked.includes(event.child_id) ? [...new Set(linked)] : [event.child_id];
}

function inputChildIds(input: FamilyEventInput): string[] {
  return [...new Set(input.childIds ?? (input.childId ? [input.childId] : []))].sort();
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
  const events = (data ?? []) as RawFamilyEventRecord[];
  const childIdsByEvent = new Map(events.map((event) => [event.id, [] as string[]]));
  if (events.length > 0) {
    const { data: links, error: linksError } = await supabase
      .from("family_event_children")
      .select("event_id, child_id")
      .eq("family_id", familyId)
      .in("event_id", events.map((event) => event.id));
    if (linksError) throw new Error(`family event child audience read failed: ${linksError.message}`);
    for (const link of links ?? []) {
      childIdsByEvent.get(link.event_id as string)?.push(link.child_id as string);
    }
  }
  return events.map((event) => ({
    ...event,
    child_ids: (childIdsByEvent.get(event.id) ?? []).sort(),
  }));
}

export async function createFamilyEvent(
  eventId: string,
  familyId: string,
  input: FamilyEventInput,
): Promise<{ id: string }> {
  const result = await supabase.rpc("save_family_event_with_children", {
    p_mode: "create",
    p_event_id: eventId,
    p_family_id: familyId,
    p_title: input.title.trim(),
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_note: input.note?.trim() || null,
    p_recurrence_rule: input.recurrence ?? null,
    p_child_ids: inputChildIds(input),
  });
  const receipt = requireMutationReceipt("create_family_event", result);
  requireReceiptValue("create_family_event", receipt === eventId);
  return { id: receipt };
}

export async function updateFamilyEvent(
  eventId: string,
  familyId: string,
  input: FamilyEventInput,
): Promise<{ id: string }> {
  const result = await supabase.rpc("save_family_event_with_children", {
    p_mode: "update",
    p_event_id: eventId,
    p_family_id: familyId,
    p_title: input.title.trim(),
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_note: input.note?.trim() || null,
    p_recurrence_rule: input.recurrence ?? null,
    p_child_ids: inputChildIds(input),
  });
  const receipt = requireMutationReceipt("update_family_event", result);
  requireReceiptValue("update_family_event", receipt === eventId);
  return { id: receipt };
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
