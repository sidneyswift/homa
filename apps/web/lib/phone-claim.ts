import { randomInt } from "node:crypto";

import { foldStubFamilyInto } from "./family-fold";
import { addFamilyPhone, removeFamilyPhone } from "./family-phone";
import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";
import { hashToken } from "./map/tokens";
import { sendHomaSms } from "./voice/telnyx-api";

/**
 * The verified phone claim (sms-onboarding-plan U2/U7, founder go
 * 2026-07-10 afternoon): typing a number proves nothing, so pointing a
 * number at a family requires POSSESSION: a 6-digit code texted to the
 * number, entered on the web.
 *
 * What a verified claim entitles her to: routing the NUMBER to the
 * family she is signed into (or holds the resume cookie for). It never
 * absorbs another real family's data; only a true stub (no members, no
 * email) folds in. If a real family held the number, the number MOVES
 * and that family keeps everything else it had.
 *
 * Codes: hashed at rest, 10 minutes, 5 attempts, 3 sends per
 * family+number per day. familyId always comes from the caller's own
 * session (requireFamily), never the request body.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_DAY = 3;

export type StartClaimResult =
  | { ok: true }
  | { ok: false; reason: "already-yours" | "send-limit" | "sms-failed" };

export async function startPhoneClaim(
  familyId: string,
  phoneE164: string,
): Promise<StartClaimResult> {
  const sql = mapDb();
  const holder = await sql<{ family_id: string }[]>`
    select family_id from public.family_phones where phone_e164 = ${phoneE164}
  `;
  if (holder[0]?.family_id === familyId) return { ok: false, reason: "already-yours" };

  const recent = await sql<{ n: string }[]>`
    select count(*)::text as n from public.phone_claim_codes
    where family_id = ${familyId} and phone_e164 = ${phoneE164}
      and created_at > now() - interval '24 hours'
  `;
  if (Number(recent[0].n) >= MAX_SENDS_PER_DAY) return { ok: false, reason: "send-limit" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const sent = await sendHomaSms(
    phoneE164,
    `Your Homa verification code is ${code}. It expires in 10 minutes. If you didn't ask for this, ignore it.`,
  );
  if (!sent) return { ok: false, reason: "sms-failed" };

  await sql`
    insert into public.phone_claim_codes (family_id, phone_e164, code_hash)
    values (${familyId}, ${phoneE164}, ${hashToken(code)})
  `;
  await emitMapEvent("sms.phone_claim_started", { family_id: familyId });
  return { ok: true };
}

export type ConfirmClaimResult =
  | { ok: true; foldedStub: boolean; movedNumber: boolean }
  | { ok: false; reason: "no-code" | "expired" | "wrong-code" | "too-many-attempts" };

export async function confirmPhoneClaim(
  familyId: string,
  phoneE164: string,
  code: string,
): Promise<ConfirmClaimResult> {
  const sql = mapDb();
  const rows = await sql<
    { id: string; code_hash: string; attempts: number; created_at: string; consumed_at: string | null }[]
  >`
    select id, code_hash, attempts, created_at::text as created_at, consumed_at::text as consumed_at
    from public.phone_claim_codes
    where family_id = ${familyId} and phone_e164 = ${phoneE164} and consumed_at is null
    order by created_at desc
    limit 1
  `;
  const claim = rows[0];
  if (!claim) return { ok: false, reason: "no-code" };
  if (Date.now() - Date.parse(claim.created_at) > CODE_TTL_MS) {
    return { ok: false, reason: "expired" };
  }
  if (claim.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too-many-attempts" };

  if (hashToken(code.trim()) !== claim.code_hash) {
    await sql`
      update public.phone_claim_codes set attempts = attempts + 1 where id = ${claim.id}
    `;
    return {
      ok: false,
      reason: claim.attempts + 1 >= MAX_ATTEMPTS ? "too-many-attempts" : "wrong-code",
    };
  }

  // Possession proven. Route the number here; fold only true stubs.
  let foldedStub = false;
  let movedNumber = false;
  const holder = await sql<{ family_id: string }[]>`
    select family_id from public.family_phones where phone_e164 = ${phoneE164}
  `;
  const holderId = holder[0]?.family_id;
  if (holderId && holderId !== familyId) {
    foldedStub = await foldStubFamilyInto(holderId, familyId);
    if (!foldedStub) {
      // A real family held it: this ONE number moves, their data (and
      // any other numbers they linked) stays.
      await removeFamilyPhone(holderId, phoneE164);
      movedNumber = true;
    }
  }

  const linked = await addFamilyPhone({
    familyId,
    phoneE164,
    addedBy: null,
    source: "home",
  });
  if (!linked.ok) {
    // A concurrent claim raced us between the clear and the set.
    return { ok: false, reason: "no-code" };
  }

  await sql`
    update public.phone_claim_codes set consumed_at = now() where id = ${claim.id}
  `;
  await emitMapEvent("sms.phone_claimed", {
    family_id: familyId,
    folded_stub: foldedStub,
    moved_number: movedNumber,
  });
  return { ok: true, foldedStub, movedNumber };
}
