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
 * setChildPhotoConsent(familyId, userId): stamps the D4 consent moment
 * (migration #75): this adult agreed, on the dedicated consent screen,
 * to child photo personalization for this family. Stamped once; a
 * second agree (another adult, another day) keeps the first record.
 */
export async function setChildPhotoConsent(familyId: string, userId: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set child_photo_consent_at = now(), child_photo_consent_by = ${userId}
    where id = ${familyId} and child_photo_consent_at is null
  `;
}

/**
 * setLessonAudioConsent(familyId, userId): stamps the lesson listen
 * consent moment (ruling lesson-listen-child-audio, plan
 * 2026-07-13-lesson-listen.md LL-0): this adult agreed, on the
 * dedicated consent screen, to lesson recordings that include their
 * child's voice. Stamped once; a second agree keeps the first record,
 * exactly like the D4 photo stamp above.
 */
export async function setLessonAudioConsent(familyId: string, userId: string): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set lesson_audio_consent_at = now(), lesson_audio_consent_by = ${userId}
    where id = ${familyId} and lesson_audio_consent_at is null
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
