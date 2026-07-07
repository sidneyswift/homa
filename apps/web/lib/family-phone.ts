import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";

/**
 * The family texting line (migration #22, founder decisions 2026-07-07):
 * one phone number per family, unique across all families, deny-all RLS.
 * This module is the ONLY code that touches family_phones, always on the
 * server-only connection, and every caller derives familyId from the
 * signed-in caller's own membership or the SMS channel's phone lookup,
 * never from client input (BUILD.md law #1).
 */

export type FamilyPhoneSource = "signup" | "home" | "bridge";

export interface FamilyPhoneRow {
  phone_e164: string;
  source: FamilyPhoneSource;
}

export type SetFamilyPhoneResult =
  | { ok: true; replaced: boolean }
  | { ok: false; reason: "taken" };

/** Reads the family's linked number, for display on /home. */
export async function getFamilyPhone(familyId: string): Promise<FamilyPhoneRow | null> {
  const sql = mapDb();
  const rows = await sql<FamilyPhoneRow[]>`
    select phone_e164, source from public.family_phones
    where family_id = ${familyId}
  `;
  return rows[0] ?? null;
}

/**
 * Links (or re-links) a number to a family. One row per family: setting a
 * new number replaces the old one. Fails softly when the number already
 * belongs to a DIFFERENT family, because a number may only ever route to
 * one family's context.
 */
export async function setFamilyPhone(input: {
  familyId: string;
  phoneE164: string;
  addedBy: string | null;
  source: FamilyPhoneSource;
}): Promise<SetFamilyPhoneResult> {
  const sql = mapDb();
  const existing = await getFamilyPhone(input.familyId);
  if (existing?.phone_e164 === input.phoneE164) {
    return { ok: true, replaced: false };
  }

  try {
    await sql`
      insert into public.family_phones (family_id, phone_e164, added_by, source)
      values (${input.familyId}, ${input.phoneE164}, ${input.addedBy}, ${input.source})
      on conflict on constraint family_phones_one_per_family
      do update set
        phone_e164 = excluded.phone_e164,
        added_by = excluded.added_by,
        source = excluded.source,
        updated_at = now()
    `;
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "taken" };
    throw error;
  }

  await emitMapEvent("sms.family_linked", {
    family_id: input.familyId,
    source: input.source,
    replaced: existing !== null,
  });
  await sendLinkNotificationSms(input.phoneE164);
  return { ok: true, replaced: existing !== null };
}

/** Unlinks the family's number (the /home card's remove action). */
export async function clearFamilyPhone(familyId: string): Promise<void> {
  const sql = mapDb();
  await sql`delete from public.family_phones where family_id = ${familyId}`;
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

/**
 * Bridge-time copy: carries a lead's signup-typed number into the real
 * family workspace. Never overwrites a number the parent set on /home,
 * and silently stands down if another family already claimed it.
 */
export async function copyLeadPhoneToFamily(
  familyId: string,
  phoneE164: string,
  addedBy: string | null,
): Promise<void> {
  const sql = mapDb();
  try {
    const rows = await sql<{ family_id: string }[]>`
      insert into public.family_phones (family_id, phone_e164, added_by, source)
      values (${familyId}, ${phoneE164}, ${addedBy}, 'bridge')
      on conflict do nothing
      returning family_id
    `;
    if (rows.length > 0) {
      await emitMapEvent("sms.family_linked", {
        family_id: familyId,
        source: "bridge",
        replaced: false,
      });
      await sendLinkNotificationSms(phoneE164);
    }
  } catch (error) {
    // Best-effort by design: the workspace bridge must never fail over a
    // phone nicety.
    console.error(
      "copyLeadPhoneToFamily failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

/**
 * The typo safety net for skipping code verification (founder call
 * 2026-07-07): whoever actually owns a freshly linked number gets one
 * text saying so, with the STOP escape hatch (Telnyx enforces opt-outs
 * at the platform level). Best-effort: linking never fails over it.
 */
async function sendLinkNotificationSms(phoneE164: string): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (process.env.TELNYX_SMS_ENABLED !== "true" || !apiKey || !fromNumber) return;

  try {
    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromNumber,
        to: phoneE164,
        text:
          "Hi, it's Homa. This number is now set up to text with me. " +
          "Say hi anytime. Not you? Reply STOP and I won't text again.",
      }),
    });
    if (!response.ok) {
      console.error(`link notification SMS failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(
      "link notification SMS failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
