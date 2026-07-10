import { setFamilyPhone } from "./family-phone";
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
  const owner = await sql<
    { family_id: string; email: string | null; members: number }[]
  >`
    select p.family_id, f.email,
           (select count(*)::int from public.family_members m where m.family_id = f.id) as members
    from public.family_phones p join public.families f on f.id = p.family_id
    where p.phone_e164 = ${request.phone_e164}
  `;
  const stub = owner[0];
  if (stub && stub.family_id !== request.family_id) {
    if (stub.email !== null || stub.members > 0) {
      return { ok: false, reason: "phone-owned-elsewhere" };
    }
    // Move everything family-scoped, then the children (child-scoped
    // rows ride along), then retire the stub. The stub's phone row
    // dies with it, freeing the number for the real family.
    for (const table of ["conversation_messages", "family_memories", "hours_log"]) {
      await sql`
        update ${sql(table)} set family_id = ${request.family_id}
        where family_id = ${stub.family_id}
      `;
    }
    await sql`
      update public.children set family_id = ${request.family_id}
      where family_id = ${stub.family_id}
    `;
    await sql`delete from public.families where id = ${stub.family_id}`;
  }

  // setFamilyPhone owns the rest: the family_phones write, the
  // sms.family_linked event, lead conversion, and the confirmation
  // text to the parent.
  const linked = await setFamilyPhone({
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
