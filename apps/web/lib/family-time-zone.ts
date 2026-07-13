import { mapDb } from "./map/db";

/**
 * The family's time zone (migration #27): one IANA name on the family
 * row so the greeting and the planner's dates render in the family's own
 * clock. Writes run on the server-only connection with familyId derived
 * from the caller's own session (BUILD.md law #1), mirroring
 * family-phone.ts's posture.
 */

/**
 * States that sit whole inside one time zone, so an address alone names
 * the clock (founder direction 2026-07-12: derive the zone from the
 * address). Split states (FL, TX, ID, IN, KS, KY, MI, ND, NE, NV, OR,
 * SD, TN) are deliberately absent: guessing wrong there breaks the
 * planner's dates, and the device capture (TimeZoneSync) covers them.
 */
const SINGLE_ZONE_STATES: Record<string, string> = {
  CT: "America/New_York", DC: "America/New_York", DE: "America/New_York",
  GA: "America/New_York", MA: "America/New_York", MD: "America/New_York",
  ME: "America/New_York", NC: "America/New_York", NH: "America/New_York",
  NJ: "America/New_York", NY: "America/New_York", OH: "America/New_York",
  PA: "America/New_York", RI: "America/New_York", SC: "America/New_York",
  VA: "America/New_York", VT: "America/New_York", WV: "America/New_York",
  AL: "America/Chicago", AR: "America/Chicago", IA: "America/Chicago",
  IL: "America/Chicago", LA: "America/Chicago", MN: "America/Chicago",
  MO: "America/Chicago", MS: "America/Chicago", OK: "America/Chicago",
  WI: "America/Chicago",
  CO: "America/Denver", MT: "America/Denver", NM: "America/Denver",
  UT: "America/Denver", WY: "America/Denver",
  AZ: "America/Phoenix",
  CA: "America/Los_Angeles", WA: "America/Los_Angeles",
  AK: "America/Anchorage",
  HI: "Pacific/Honolulu",
};

/** The zone an address state implies, or null when the state spans two. */
export function timeZoneFromState(usState: string): string | null {
  return SINGLE_ZONE_STATES[usState] ?? null;
}

/** Real IANA names only: the runtime itself is the validator. */
export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function setFamilyTimeZone(familyId: string, timeZone: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set time_zone = ${timeZone}, updated_at = now()
    where id = ${familyId}
  `;
}

/** The device-capture path: fills the zone only while it is unset, so a
 * parent's explicit settings choice is never clobbered by a visit from
 * grandma's laptop. */
export async function fillFamilyTimeZoneIfEmpty(
  familyId: string,
  timeZone: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set time_zone = ${timeZone}, updated_at = now()
    where id = ${familyId} and time_zone is null
  `;
}
