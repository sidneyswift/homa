import { supabase } from "./supabase";
import { requireMutationReceipt } from "./mutation-receipt";

/**
 * Reads and edits for hours_log, ported from apps/web/lib/hours.ts and
 * app/app/hours/actions.ts. Creating a new entry stays agent-only on
 * both platforms (log_hours, chat/SMS/voice): there is no "add entry"
 * UI on web either. Editing and deleting an EXISTING row is a real
 * parent-facing feature there, and the table's RLS (full insert/
 * update/delete for authenticated family members, migrations
 * 20260709211000 + 20260726120000) makes the same direct, RLS-scoped
 * writes safe here.
 */

export const HOURS_SUBJECTS = [
  "reading",
  "math",
  "science",
  "social studies",
  "art",
  "music",
  "PE",
  "co-op",
  "life skills",
  "other",
  // Mirrors apps/web/lib/hours-model.ts (2026-08-28): the one subject
  // that maps 1:1 onto the real progress-report taxonomy's "spanish"
  // ("Second language"). Kept in sync by hand, same as the rest of this
  // file's port from web.
  "spanish",
] as const;

export type HoursSubject = (typeof HOURS_SUBJECTS)[number];

function isHoursSubject(value: string): value is HoursSubject {
  return (HOURS_SUBJECTS as readonly string[]).includes(value);
}

export type HoursSource = "chat" | "sms" | "call";

export interface HoursLogRow {
  id: string;
  childId: string | null;
  subject: HoursSubject;
  minutes: number;
  /** YYYY-MM-DD, the calendar day the block happened on, not a timestamp. */
  happenedOn: string;
  source: HoursSource;
  note: string | null;
}

function normalizeSource(value: string): HoursSource {
  return value === "sms" || value === "call" ? value : "chat";
}

const MAX_HOURS_ROWS = 3000;

function toHoursLogRow(row: {
  id: unknown;
  child_id: unknown;
  subject: unknown;
  minutes: unknown;
  happened_on: unknown;
  source: unknown;
  note: unknown;
}): HoursLogRow {
  const subjectRaw = row.subject as string;
  return {
    id: row.id as string,
    childId: (row.child_id as string | null) ?? null,
    subject: isHoursSubject(subjectRaw) ? subjectRaw : "other",
    minutes: row.minutes as number,
    happenedOn: row.happened_on as string,
    source: normalizeSource(row.source as string),
    note: (row.note as string | null) ?? null,
  };
}

export async function getHoursLogForFamily(familyId: string): Promise<HoursLogRow[]> {
  const { data, error } = await supabase
    .from("hours_log")
    .select("id, child_id, subject, minutes, happened_on, source, note")
    .eq("family_id", familyId)
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_HOURS_ROWS);
  if (error) throw new Error(`hours_log read failed: ${error.message}`);
  return (data ?? []).map(toHoursLogRow);
}

/** Loads only the Planner's visible calendar window. The full Hours
 * record keeps its existing unbounded-by-date query. */
export async function getHoursLogForFamilyBetween(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<HoursLogRow[]> {
  const { data, error } = await supabase
    .from("hours_log")
    .select("id, child_id, subject, minutes, happened_on, source, note")
    .eq("family_id", familyId)
    .gte("happened_on", fromDate)
    .lte("happened_on", toDate)
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_HOURS_ROWS);
  if (error) throw new Error(`hours_log Planner read failed: ${error.message}`);
  return (data ?? []).map(toHoursLogRow);
}

export interface HoursEntryEdit {
  subject: HoursSubject;
  minutes: number;
  note: string | null;
}

export async function updateHoursEntry(
  entryId: string,
  edit: HoursEntryEdit,
): Promise<{ id: string }> {
  const result = await supabase
    .from("hours_log")
    .update({ subject: edit.subject, minutes: edit.minutes, note: edit.note })
    .eq("id", entryId)
    .select("id")
    .maybeSingle();
  return requireMutationReceipt("update_hours_entry", result);
}

export async function deleteHoursEntry(entryId: string): Promise<{ id: string }> {
  const result = await supabase
    .from("hours_log")
    .delete()
    .eq("id", entryId)
    .select("id")
    .maybeSingle();
  return requireMutationReceipt("delete_hours_entry", result);
}
