import { sendHomaContactCard } from "./contact-card";
import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";
import { markLeadConverted } from "./phone-leads";

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
 * Returns only whether this family has a linked texting row. Parent-facing
 * handoffs use this instead of loading or serializing phone values.
 */
export async function hasFamilyPhone(familyId: string): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from public.family_phones
      where family_id = ${familyId}
    ) as exists
  `;
  return rows[0]?.exists ?? false;
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
 * Moves a number to another family: the founder's lend-and-return lever
 * between their real family and test families (founder ask 2026-07-14
 * evening). Same mechanics as the verified claim's move: the old row
 * dies and a NEW row is born, so the SMS session epoch rotates and no
 * chat context follows the number across families. No notification
 * text: the founder is the one moving it. Callers own authorization;
 * this only moves.
 */
export async function moveFamilyPhone(input: {
  phoneE164: string;
  toFamilyId: string;
  memberUserId: string | null;
}): Promise<{ ok: true; fromFamilyId: string | null }> {
  const sql = mapDb();
  let fromFamilyId: string | null = null;
  await sql.begin(async (tx) => {
    const holder = await tx<{ family_id: string }[]>`
      select family_id from public.family_phones
      where phone_e164 = ${input.phoneE164}
      for update
    `;
    fromFamilyId = holder[0]?.family_id ?? null;
    if (fromFamilyId === input.toFamilyId) return;
    if (fromFamilyId) {
      await tx`
        delete from public.family_phones
        where family_id = ${fromFamilyId} and phone_e164 = ${input.phoneE164}
      `;
    }
    await tx`
      insert into public.family_phones (family_id, phone_e164, added_by, member_user_id, source)
      values (${input.toFamilyId}, ${input.phoneE164}, ${input.memberUserId}, ${input.memberUserId}, 'home')
    `;
  });
  return { ok: true, fromFamilyId };
}

export interface FounderPhoneHome {
  familyId: string;
  familyName: string;
  phoneNumbers: string[];
}

/**
 * The founder's REAL family: the oldest non-sandbox, non-deleted family
 * their auth user is a member of, with its linked numbers. This is the
 * destination "send my number home" restores to, and the prefill for
 * lending. Null when the founder's account has no real family.
 */
export async function founderPhoneHome(
  founderUserId: string,
): Promise<FounderPhoneHome | null> {
  const sql = mapDb();
  const families = await sql<{ id: string; name: string }[]>`
    select f.id, f.name
    from public.family_members m
    join public.families f on f.id = m.family_id
    where m.user_id = ${founderUserId}
      and not f.sandbox
      and f.status <> 'deleted'
    order by m.created_at
    limit 1
  `;
  const home = families[0];
  if (!home) return null;
  const phones = await getFamilyPhones(home.id);
  return {
    familyId: home.id,
    familyName: home.name,
    phoneNumbers: phones.map((row) => row.phone_e164),
  };
}

/** True when this auth user holds a membership row in the family. */
export async function isFamilyMemberUser(
  familyId: string,
  userId: string,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ one: number }[]>`
    select 1 as one from public.family_members
    where family_id = ${familyId} and user_id = ${userId}
    limit 1
  `;
  return rows.length > 0;
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
  /** Stable adult identity for conversation attribution. Null only for
   * legacy/unattributed phone rows. */
  memberUserId: string | null;
  /** The linked adult's display name, when the number carries member
   * attribution and that member set one. Null keeps the caller generic. */
  memberDisplayName: string | null;
  /** Only a phone attributed to a real signed-in family member may
   * delegate access to another adult. Phone-only invitees cannot. */
  canInviteFamilyMembers: boolean;
  /** The routing row id is this access grant's generation. Removing and
   * re-adding the phone creates a new id and therefore a new Eve session. */
  sessionEpoch: string;
  /** A memberless family created by begin_text_signup must rehydrate its
   * questionnaire after the access-epoch rotation. */
  smsSignupCandidate: boolean;
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
  const rows = await sql<
    {
      family_id: string;
      phone_row_id: string;
      member_user_id: string | null;
      display_name: string | null;
      can_invite_family_members: boolean;
      sms_signup_candidate: boolean;
    }[]
  >`
    select p.family_id, p.id::text as phone_row_id,
           p.member_user_id, m.display_name,
           m.user_id is not null as can_invite_family_members,
           p.source = 'signup' and not exists (
             select 1 from public.family_members signup_member
             where signup_member.family_id = p.family_id
           ) as sms_signup_candidate
    from public.family_phones p
    left join public.family_members m
      on m.family_id = p.family_id and m.user_id = p.member_user_id
    where p.phone_e164 = ${phoneE164}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    familyId: row.family_id,
    memberUserId: row.member_user_id,
    memberDisplayName: row.display_name,
    canInviteFamilyMembers: row.can_invite_family_members,
    sessionEpoch: `family-phone:${row.phone_row_id}`,
    smsSignupCandidate: row.sms_signup_candidate,
  };
}

/**
 * Last access-boundary generation for a phone, retained after unlinking.
 * This keeps an unlinked number from resuming model history created before
 * a prior link or removal.
 */
export async function findPhoneAccessEpoch(
  phoneE164: string,
): Promise<string | null> {
  const sql = mapDb();
  const rows = await sql<{ epoch: string }[]>`
    select epoch::text as epoch
    from public.family_phone_access_epochs
    where phone_e164 = ${phoneE164}
  `;
  return rows[0] ? `phone-access:${rows[0].epoch}` : null;
}

/**
 * The typo safety net for skipping code verification (founder call
 * 2026-07-07): whoever actually owns a freshly linked number gets one
 * text saying so, with the STOP escape hatch (Telnyx enforces opt-outs
 * at the platform level, and since 2026-07-23 the inbound handler also
 * records them in sms_suppressions so Homa's own send paths skip the
 * number instead of relying on the carrier block). The text carries
 * Homa's contact card as MMS
 * media (founder ask 2026-07-10) so the owner can save who is texting;
 * the multi-parent v0 rewrite dropped the card by accident and this
 * restores it (regression found 2026-07-14). Best-effort: linking
 * never fails over it.
 */
async function sendLinkNotificationSms(phoneE164: string): Promise<void> {
  // Dark-channel posture: a deployment without a live texting line
  // skips silently, no send attempt, no misleading event row.
  if (process.env.TELNYX_SMS_ENABLED !== "true") return;
  try {
    const sent = await sendHomaContactCard(
      phoneE164,
      "Hi, it's Homa. This number is now set up to text with me. " +
        "Here's my contact card so you can save me. Say hi anytime. " +
        "Not you? Reply STOP and I won't text again.",
    );
    await emitMapEvent("sms.contact_card_sent", { trigger: "linked", sent });
  } catch (error) {
    console.error(
      "link notification SMS failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
