import { isHoursSubject, type HoursSubject } from "./hours-model";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * Server-side hours_log reads for the /app/hours page (CG-02, issue
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

export async function getHoursLogForFamily(familyId: string): Promise<HoursLogRow[]> {
  const supabase = await createSupabaseServerClient();
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
