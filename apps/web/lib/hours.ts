import { isHoursSubject, requireHoursSource, type HoursSource, type HoursSubject } from "./hours-model";
import { hoursReadIsComplete, minutesBySubjectForChild, resolveHoursWindow } from "./hours-summary";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * Server-side hours_log reads for the Planner Hours view (CG-02, issue
 * #174). All reads run under the caller's RLS context (publishable key
 * + session JWT), so every row is family-scoped by the database itself;
 * the explicit family_id predicate below is the same defense-in-depth
 * every other /app reader uses (e.g. findMaterialsCaller).
 */

/** Bounded rows are a preview. Only an exact-count receipt establishes completeness. */
const MAX_HOURS_ROWS = 3000;

export type { HoursSource } from "./hours-model";

export interface HoursLogRow {
  id: string;
  childId: string | null;
  subject: HoursSubject;
  /** The parent's own name for this block ("Literature journal"), under
   * any subject. Null until she sets one. */
  customLabel: string | null;
  minutes: number;
  /** YYYY-MM-DD, the calendar day the parent (or model) said the block
   * happened on, not a timestamp. */
  happenedOn: string;
  source: HoursSource;
  note: string | null;
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
    customLabel: row.custom_label ?? null,
    minutes: row.minutes,
    happenedOn: row.happened_on,
    source: requireHoursSource(row.source),
    note: row.note ?? null,
  };
}

const HOURS_LOG_COLUMNS = "id, child_id, subject, custom_label, minutes, happened_on, source, note";

export interface HoursLogRead {
  rows: HoursLogRow[];
  complete: boolean;
}

async function readHoursLogForFamily(
  familyId: string,
  fromDate: string | null,
  throughDate: string | null,
): Promise<HoursLogRead> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("hours_log")
    .select(HOURS_LOG_COLUMNS, { count: "exact" })
    .eq("family_id", familyId);
  if (fromDate !== null) query = query.gte("happened_on", fromDate);
  if (throughDate !== null) query = query.lte("happened_on", throughDate);
  const { data, error, count } = await query
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MAX_HOURS_ROWS);
  if (error) throw new Error(`hours_log read failed: ${error.message}`);
  const rows = (data ?? []).map((row) => toHoursLogRow(row as RawHoursLogRow));
  return { rows, complete: hoursReadIsComplete(count, rows.length) };
}

export async function getHoursLogForFamily(familyId: string): Promise<HoursLogRead> {
  return readHoursLogForFamily(familyId, null, null);
}

/** Explicit historical views retain their supplied inclusive range. */
export async function getHoursLogForFamilyBetween(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<HoursLogRow[]> {
  return (await readHoursLogForFamily(familyId, fromDate, toDate)).rows;
}

/** Display-only Progress time. Incomplete retrieval cannot become a total. */
export async function getHoursMinutesBySubjectForChild(
  familyId: string,
  childId: string,
  todayIso: string,
  schoolYearStartOn: string | null,
): Promise<Partial<Record<HoursSubject, number>>> {
  const window = resolveHoursWindow("school_year", todayIso, schoolYearStartOn);
  const read = await readHoursLogForFamily(familyId, window.from, window.through);
  if (!read.complete) throw new Error("Hours total unavailable: incomplete record.");
  return minutesBySubjectForChild(read.rows, childId, window.from, window.through);
}
