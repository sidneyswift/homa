import { supabase } from "./supabase";

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

export async function getHoursLogForFamily(familyId: string): Promise<HoursLogRow[]> {
  const { data, error } = await supabase
    .from("hours_log")
    .select("id, child_id, subject, minutes, happened_on, source, note")
    .eq("family_id", familyId)
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_HOURS_ROWS);
  if (error) throw new Error(`hours_log read failed: ${error.message}`);
  return (data ?? []).map((row) => {
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
  });
}

export interface HoursEntryEdit {
  subject: HoursSubject;
  minutes: number;
  note: string | null;
}

export async function updateHoursEntry(
  entryId: string,
  edit: HoursEntryEdit,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("hours_log")
    .update({ subject: edit.subject, minutes: edit.minutes, note: edit.note })
    .eq("id", entryId);
  return { error: error ? error.message : null };
}

export async function deleteHoursEntry(entryId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("hours_log").delete().eq("id", entryId);
  return { error: error ? error.message : null };
}
