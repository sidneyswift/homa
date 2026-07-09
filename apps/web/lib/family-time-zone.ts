import { mapDb } from "./map/db";

/**
 * The family's time zone (migration #27): one IANA name on the family
 * row so the greeting and the planner's dates render in the family's own
 * clock. Writes run on the server-only connection with familyId derived
 * from the caller's own session (BUILD.md law #1), mirroring
 * family-phone.ts's posture.
 */

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
