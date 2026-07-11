import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";
import { markLeadConverted } from "./phone-leads";
import { sendHomaSms } from "./voice/telnyx-api";

/**
 * The family texting lines (migration #22, one per family; migrations
 * #49/#50 made it one per ADULT, multi-parent v0 plan 2026-07-11): each
 * linked number routes to exactly one family (phone_e164 stays unique
 * across all families), and a family may hold several numbers, one per
 * parent. Deny-all RLS: this module is the ONLY code that touches
 * family_phones, always on the server-only connection, and every caller
 * derives familyId from the signed-in caller's own membership or the SMS
 * channel's phone lookup, never from client input (BUILD.md law #1).
 */

export type FamilyPhoneSource = "signup" | "home" | "bridge";

export interface FamilyPhoneRow {
  phone_e164: string;
  source: FamilyPhoneSource;
  /** The adult this number belongs to (migration #49); null on rows
   * linked before per-member attribution existed. */
  member_user_id: string | null;
}

export type AddFamilyPhoneResult =
  | { ok: true; added: boolean }
  | { ok: false; reason: "taken" };

/** Every number linked to the family, oldest first (settings list,
 * outbound-call default, dispatch delivery fan-out). */
export async function getFamilyPhones(familyId: string): Promise<FamilyPhoneRow[]> {
  const sql = mapDb();
  return await sql<FamilyPhoneRow[]>`
    select phone_e164, source, member_user_id::text as member_user_id
    from public.family_phones
    where family_id = ${familyId}
    order by created_at
  `;
}

/**
 * Links a number to a family. Numbers accumulate (one per adult);
 * re-adding a number the family already holds is a quiet success that
 * updates its member attribution. Fails softly when the number belongs
 * to a DIFFERENT family, because a number may only ever route to one
 * family's context.
 */
export async function addFamilyPhone(input: {
  familyId: string;
  phoneE164: string;
  addedBy: string | null;
  source: FamilyPhoneSource;
}): Promise<AddFamilyPhoneResult> {
  const sql = mapDb();

  const holder = await sql<{ family_id: string }[]>`
    select family_id from public.family_phones where phone_e164 = ${input.phoneE164}
  `;
  if (holder[0]) {
    if (holder[0].family_id !== input.familyId) return { ok: false, reason: "taken" };
    // Already this family's number: refresh member attribution quietly
    // (no event, no re-notification text), matching the old no-op path.
    await sql`
      update public.family_phones
      set member_user_id = coalesce(member_user_id, ${input.addedBy}), updated_at = now()
      where family_id = ${input.familyId} and phone_e164 = ${input.phoneE164}
    `;
    return { ok: true, added: false };
  }

  // "do nothing" (no conflict target) also absorbs the one-per-family
  // constraint still live in the window before migration #50 applies:
  // a second number then reads as taken rather than erroring the caller.
  const rows = await sql<{ family_id: string }[]>`
    insert into public.family_phones (family_id, phone_e164, added_by, member_user_id, source)
    values (${input.familyId}, ${input.phoneE164}, ${input.addedBy}, ${input.addedBy}, ${input.source})
    on conflict do nothing
    returning family_id
  `;
  if (rows.length === 0) return { ok: false, reason: "taken" };

  await emitMapEvent("sms.family_linked", {
    family_id: input.familyId,
    source: input.source,
    replaced: false,
  });
  await markLeadConverted(input.phoneE164).catch(() => {});
  await sendLinkNotificationSms(input.phoneE164);
  return { ok: true, added: true };
}

/** Unlinks ONE of the family's numbers (the /app/settings row's remove
 * action, and the verified claim pulling a number out of its old home). */
export async function removeFamilyPhone(familyId: string, phoneE164: string): Promise<void> {
  const sql = mapDb();
  await sql`
    delete from public.family_phones
    where family_id = ${familyId} and phone_e164 = ${phoneE164}
  `;
}

/**
 * Resolves an inbound text's sender to its family. This lookup IS the SMS
 * channel's auth step: the mapping was written by the signed-in parent,
 * so possession of the number routes to (only) that family's context.
 */
export async function findFamilyIdByPhone(phoneE164: string): Promise<string | null> {
  const sql = mapDb();
  const rows = await sql<{ family_id: string }[]>`
    select family_id from public.family_phones
    where phone_e164 = ${phoneE164}
  `;
  return rows[0]?.family_id ?? null;
}

export interface FamilyPhoneIdentity {
  familyId: string;
  /** The linked adult's display name, when the number carries member
   * attribution and that member set one. Null keeps the caller generic. */
  memberDisplayName: string | null;
}

/**
 * The identity-aware twin of findFamilyIdByPhone: same auth basis, plus
 * WHICH adult this number belongs to, so SMS and voice can address
 * Sidney as Sidney and Alessa as Alessa (multi-parent v0).
 */
export async function findFamilyIdentityByPhone(
  phoneE164: string,
): Promise<FamilyPhoneIdentity | null> {
  const sql = mapDb();
  const rows = await sql<{ family_id: string; display_name: string | null }[]>`
    select p.family_id, m.display_name
    from public.family_phones p
    left join public.family_members m
      on m.family_id = p.family_id and m.user_id = p.member_user_id
    where p.phone_e164 = ${phoneE164}
  `;
  const row = rows[0];
  if (!row) return null;
  return { familyId: row.family_id, memberDisplayName: row.display_name };
}

/**
 * The typo safety net for skipping code verification (founder call
 * 2026-07-07): whoever actually owns a freshly linked number gets one
 * text saying so, with the STOP escape hatch (Telnyx enforces opt-outs
 * at the platform level). Best-effort: linking never fails over it.
 */
async function sendLinkNotificationSms(phoneE164: string): Promise<void> {
  await sendHomaSms(
    phoneE164,
    "Hi, it's Homa. This number is now set up to text with me. " +
      "Say hi anytime. Not you? Reply STOP and I won't text again.",
  );
}
