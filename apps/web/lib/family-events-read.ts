import { listFamilyEventsCaller, type FamilyEventRow } from "./family-events";
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
  return listFamilyEventsCaller(supabase, familyId, fromDate, toDate);
}
