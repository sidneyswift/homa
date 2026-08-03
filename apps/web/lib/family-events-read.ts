import {
  EVENT_COLUMNS,
  getFamilyEventChildIdsCaller,
  getFamilyEventOccurrenceExceptionsCaller,
  toFamilyEventRow,
  type FamilyEventRow,
  type RawFamilyEventRow,
} from "./family-events";
import { createSupabaseServerClient } from "./supabase/server";

/**
 * The Planner page's family_events read, under the caller's own
 * RLS session, the same posture as lib/hours.ts's getHoursLogForFamily.
 *
 * Deliberately its OWN file, separate from lib/family-events.ts: this
 * import pulls in next/headers via createSupabaseServerClient, which
 * eve's standalone tool build cannot resolve (VERCEL=1 eve build fails
 * outside Next's own bundler when an agent tool transitively imports
 * next/headers). No agent tool may import this file; lib/family-events.ts
 * carries every function the agent tools actually use.
 */
export async function getFamilyEventsForFamily(
  familyId: string,
  fromDate: string,
  toDate: string,
): Promise<FamilyEventRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("family_events")
    .select(EVENT_COLUMNS)
    .eq("family_id", familyId)
    .lte("starts_on", toDate)
    .or(`ends_on.gte.${fromDate},recurrence_rule.not.is.null`)
    .order("starts_on", { ascending: true });
  if (error) throw new Error(`family_events read failed: ${error.message}`);
  const rows = (data ?? []) as RawFamilyEventRow[];
  const eventIds = rows.map((row) => row.id);
  const [childIdsByEvent, exceptionsByEvent] = await Promise.all([
    getFamilyEventChildIdsCaller(supabase, familyId, eventIds),
    getFamilyEventOccurrenceExceptionsCaller(supabase, familyId, eventIds),
  ]);
  return rows.map((row) => toFamilyEventRow({
    ...row,
    child_ids: childIdsByEvent.get(row.id) ?? [],
    occurrence_exceptions: (exceptionsByEvent.get(row.id) ?? []).map((exception) => ({
      occurrence_on: exception.occurrenceOn,
      kind: exception.kind,
      starts_on: exception.startsOn,
      ends_on: exception.endsOn,
      start_time: exception.startTime,
      end_time: exception.endTime,
    })),
  }));
}
