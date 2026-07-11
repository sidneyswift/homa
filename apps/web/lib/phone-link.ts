import { foldStubFamilyInto } from "./family-fold";
import { addFamilyPhone } from "./family-phone";
import { mapDb } from "./map/db";
import { sendAgentComposedEmail, siteUrl } from "./map/email";
import { hashToken, newToken } from "./map/tokens";

/**
 * The verified reconciliation path for "this email already has a Homa
 * account" during text signup (unknowns pass 2026-07-10, U3). Inbox
 * possession is the proof: Homa emails the EXISTING account a one-time
 * link; clicking it folds the text-signup stub into the real family
 * (children, answers, conversation record, memories, hours all move)
 * and links the phone, so her texts pick up in her real workspace.
 *
 * Tokens are single-use, 48h, hashed at rest (the same posture as the
 * resume tokens). The stub-fold is deliberately conservative: it only
 * ever folds a family with NO members and NO email (a true text stub);
 * anything else refuses and leaves both families untouched.
 */

const LINK_WINDOW_HOURS = 48;

export async function mintPhoneLinkRequest(
  realFamilyId: string,
  phoneE164: string,
): Promise<string> {
  const sql = mapDb();
  const token = newToken();
  await sql`
    insert into public.phone_link_requests (family_id, phone_e164, token_hash)
    values (${realFamilyId}, ${phoneE164}, ${hashToken(token)})
  `;
  return token;
}

export async function sendPhoneLinkEmail(
  to: string,
  realFamilyId: string,
  phoneE164: string,
): Promise<boolean> {
  const token = await mintPhoneLinkRequest(realFamilyId, phoneE164);
  const url = `${siteUrl()}/api/link-phone?t=${token}`;
  return sendAgentComposedEmail(to, "Connect texting to your Homa account", [
    "Someone (almost certainly you) was texting with Homa and gave this email as theirs.",
    `Tap the link to connect that phone number to your Homa account, and those texts will pick up right where your family's records live: ${url}`,
    "If this wasn't you, ignore this email and nothing changes.",
  ]);
}

export interface ConsumePhoneLinkResult {
  ok: boolean;
  reason?: "invalid" | "expired" | "phone-owned-elsewhere";
}

/** Consumes a link token: folds the phone's text stub (if any) into the
 * real family and links the number to it. Idempotent per token. */
export async function consumePhoneLinkRequest(rawToken: string): Promise<ConsumePhoneLinkResult> {
  const sql = mapDb();
  const rows = await sql<
    { id: string; family_id: string; phone_e164: string; created_at: string; consumed_at: string | null }[]
  >`
    select id, family_id, phone_e164, created_at::text as created_at, consumed_at::text as consumed_at
    from public.phone_link_requests where token_hash = ${hashToken(rawToken)}
  `;
  const request = rows[0];
  if (!request) return { ok: false, reason: "invalid" };
  if (request.consumed_at) return { ok: true };
  if (Date.now() - Date.parse(request.created_at) > LINK_WINDOW_HOURS * 60 * 60 * 1000) {
    return { ok: false, reason: "expired" };
  }

  // Whoever holds the number now: a true text stub folds in; a real
  // family keeping the number is a conflict this flow must not touch.
  const owner = await sql<{ family_id: string }[]>`
    select family_id from public.family_phones where phone_e164 = ${request.phone_e164}
  `;
  const holderId = owner[0]?.family_id;
  if (holderId && holderId !== request.family_id) {
    const folded = await foldStubFamilyInto(holderId, request.family_id);
    if (!folded) return { ok: false, reason: "phone-owned-elsewhere" };
  }

  // addFamilyPhone owns the rest: the family_phones write, the
  // sms.family_linked event, lead conversion, and the confirmation
  // text to the parent.
  const linked = await addFamilyPhone({
    familyId: request.family_id,
    phoneE164: request.phone_e164,
    addedBy: null,
    source: "bridge",
  });
  if (!linked.ok) return { ok: false, reason: "phone-owned-elsewhere" };

  await sql`
    update public.phone_link_requests set consumed_at = now() where id = ${request.id}
  `;
  return { ok: true };
}
