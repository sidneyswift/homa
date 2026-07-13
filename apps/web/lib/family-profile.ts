import { mapDb } from "./map/db";

/**
 * Settings-page profile writes (settings redesign 2026-07-12): the
 * family's own name and address, and each adult's display name and
 * avatar. families and family_members are deny-all for writes under
 * RLS, so everything here runs on the server-only connection with
 * familyId derived from the caller's OWN membership (getMyFamily under
 * RLS), never from the form (BUILD.md law #1), mirroring
 * family-phone.ts and family-time-zone.ts.
 */

/**
 * getFamilyMemberEmails(familyId): userId -> email for the family's
 * adults. auth.users is not readable under RLS, so this is the one
 * roster read that runs server-only; co-parents joined by emailed
 * invite, so each other's addresses are not a secret inside the family.
 */
export async function getFamilyMemberEmails(familyId: string): Promise<Map<string, string>> {
  const sql = mapDb();
  const rows = await sql<{ user_id: string; email: string | null }[]>`
    select m.user_id, u.email
    from public.family_members m
    join auth.users u on u.id = m.user_id
    where m.family_id = ${familyId}
  `;
  return new Map(rows.filter((row) => row.email).map((row) => [row.user_id, row.email as string]));
}

/**
 * setFamilyName(familyId, name): renames the family everywhere (the
 * settings eyebrow, the sidebar footer, greetings).
 */
export async function setFamilyName(familyId: string, name: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set name = ${name}, updated_at = now()
    where id = ${familyId}
  `;
}

export interface FamilyAddressInput {
  addressLine: string;
  city: string;
  usState: string;
  zip: string;
}

/**
 * setFamilyAddress(familyId, address): the family moved. us_state also
 * drives which state's homeschool rules Homa follows.
 */
export async function setFamilyAddress(
  familyId: string,
  address: FamilyAddressInput,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set address_line = ${address.addressLine},
        address_city = ${address.city},
        us_state = ${address.usState},
        address_zip = ${address.zip},
        updated_at = now()
    where id = ${familyId}
  `;
}

/**
 * setMemberDisplayName(familyId, userId, displayName): what Homa calls
 * this adult, on their own membership row (multi-parent v0: greetings
 * and channel identity prefer it over the family-level name).
 */
export async function setMemberDisplayName(
  familyId: string,
  userId: string,
  displayName: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.family_members
    set display_name = ${displayName}
    where family_id = ${familyId} and user_id = ${userId}
  `;
}

/**
 * setMemberAvatarUrl(familyId, userId, avatarUrl): this adult's own
 * photo (migration #74). The caller validates the URL points at our
 * avatars bucket before it gets here; null clears the photo.
 */
export async function setMemberAvatarUrl(
  familyId: string,
  userId: string,
  avatarUrl: string | null,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.family_members
    set avatar_url = ${avatarUrl}
    where family_id = ${familyId} and user_id = ${userId}
  `;
}
