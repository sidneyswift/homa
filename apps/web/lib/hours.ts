import { isHoursSubject, type HoursSubject } from "./hours-model";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * Server-side hours_log reads for the Planner Hours view (CG-02, issue
 * #174). All reads run under the caller's RLS context (publishable key
 * + session JWT), so every row is family-scoped by the database itself;
 * the explicit family_id predicate below is the same defense-in-depth
 * every other /app reader uses (e.g. findMaterialsCaller).
 */

/** hours_log rows accrue fast across chat, SMS, and phone-call capture
 * (a single call can log several blocks at once); comfortably above
 * what one family logs in a school year before this needs real
 * pagination (M2+ scope, same stopgap posture as the Binder's cap). */
const MAX_HOURS_ROWS = 3000;

export type HoursSource = "chat" | "sms" | "call";

export interface HoursLogRow {
  id: string;
  childId: string | null;
  subject: HoursSubject;
  /** The parent's own name for an "other" block ("Portuguese"), never
   * set for any other subject (DB constraint). Null until she edits it. */
  customLabel: string | null;
  minutes: number;
  /** YYYY-MM-DD, the calendar day the parent (or model) said the block
   * happened on, not a timestamp. */
  happenedOn: string;
  source: HoursSource;
  note: string | null;
}

function normalizeSource(value: string): HoursSource {
  return value === "sms" || value === "call" ? value : "chat";
}

interface RawHoursLogRow {
  id: string;
  child_id: string | null;
  subject: string;
  custom_label: string | null;
  minutes: number;
  happened_on: string;
  source: string;
  note: string | null;
}

function toHoursLogRow(row: RawHoursLogRow): HoursLogRow {
  const subject = isHoursSubject(row.subject) ? row.subject : "other";
  return {
    id: row.id,
    childId: row.child_id ?? null,
    subject,
    customLabel: subject === "other" ? row.custom_label ?? null : null,
    minutes: row.minutes,
    happenedOn: row.happened_on,
    source: normalizeSource(row.source),
    note: row.note ?? null,
  };
}

const HOURS_LOG_COLUMNS = "id, child_id, subject, custom_label, minutes, happened_on, source, note";

export async function getHoursLogForFamily(familyId: string): Promise<HoursLogRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hours_log")
    .select(HOURS_LOG_COLUMNS)
    .eq("family_id", familyId)
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_HOURS_ROWS);
  if (error) throw new Error(`hours_log read failed: ${error.message}`);
  return (data ?? []).map((row) => toHoursLogRow(row as RawHoursLogRow));
}

/** The Day, Week, and Month Planner reads only the dates already in view.
 * The full compliance record remains exclusive to the Hours view. */
export async function getHoursLogForFamilyBetween(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<HoursLogRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hours_log")
    .select(HOURS_LOG_COLUMNS)
    .eq("family_id", familyId)
    .gte("happened_on", fromDate)
    .lte("happened_on", toDate)
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_HOURS_ROWS);
  if (error) throw new Error(`hours_log bounded read failed: ${error.message}`);
  return (data ?? []).map((row) => toHoursLogRow(row as RawHoursLogRow));
}
