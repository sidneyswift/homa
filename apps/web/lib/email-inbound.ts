import { mapDb } from "./map/db";

/**
 * Parsing and family resolution for the inbound email adapter
 * (agent/channels/email.ts; gateway-plan GW-3). Kept out of the channel
 * file so the shapes are unit-testable and the channel stays a thin
 * adapter.
 *
 * Trust model, stated plainly: the webhook is keyed-URL authenticated
 * (possession of the URL + secret is the wall, the same posture as every
 * Telnyx webhook here). From-address matching then scopes the turn to
 * the family that REGISTERED that address; a spoofed sender who somehow
 * also held the webhook secret could still only reach that family's own
 * pinned scope, and every write passes the shared guards and scans.
 */

export interface InboundEmail {
  fromEmail: string | null;
  subject: string;
  text: string;
}

/** Tolerant extraction from Resend inbound webhook payloads. */
export function parseInboundEmail(body: unknown): InboundEmail {
  const data = ((body ?? {}) as { data?: Record<string, unknown> }).data ?? (body as Record<string, unknown>);

  let fromEmail: string | null = null;
  const from = data.from as unknown;
  if (typeof from === "string") {
    const match = from.match(/<([^>]+)>/);
    fromEmail = (match ? match[1] : from).trim().toLowerCase() || null;
  } else if (from && typeof from === "object") {
    const candidate = (from as { email?: unknown }).email;
    if (typeof candidate === "string") fromEmail = candidate.trim().toLowerCase();
  }

  const subject = typeof data.subject === "string" ? data.subject : "";

  let text = typeof data.text === "string" ? data.text : "";
  if (!text && typeof data.html === "string") {
    text = data.html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");
  }

  return { fromEmail, subject, text: stripReplyTail(text).trim() };
}

/** Cuts the quoted history a mail client appends under a reply. */
export function stripReplyTail(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^on .{5,90} wrote:$/i.test(trimmed)) break;
    if (/^-{2,}\s*original message\s*-{2,}$/i.test(trimmed)) break;
    if (/^from:\s.+@/i.test(trimmed) && kept.length > 0) break;
    if (trimmed.startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n");
}

/** "stop"-shaped replies opt the family out without an agent turn;
 * "start"-shaped ones opt back in. */
export function optOutIntent(text: string): "stop" | "start" | null {
  const normalized = text.trim().toLowerCase().replace(/[.!]+$/, "");
  if (["stop", "unsubscribe", "stop please", "please stop"].includes(normalized)) return "stop";
  if (["start", "resume", "start again"].includes(normalized)) return "start";
  return null;
}

export interface FamilyEmailIdentity {
  familyId: string;
  /** The member's display name when the address matched a member's
   * sign-in email; null when only the family-level address matched. */
  memberDisplayName: string | null;
}

/** Finds the family that registered this exact address and, when the
 * address belongs to a member, identifies which adult wrote in. */
export async function findFamilyIdentityByEmail(
  email: string,
): Promise<FamilyEmailIdentity | null> {
  const sql = mapDb();
  const normalized = email.toLowerCase();
  const rows = await sql<{ family_id: string; display_name: string | null }[]>`
    select m.family_id, m.display_name
    from public.family_members m
    join auth.users u on u.id = m.user_id
    where lower(u.email) = ${normalized}
    limit 1
  `;
  if (rows[0]) {
    return { familyId: rows[0].family_id, memberDisplayName: rows[0].display_name };
  }
  const familyRows = await sql<{ id: string }[]>`
    select id from public.families where lower(email) = ${normalized} limit 1
  `;
  return familyRows[0] ? { familyId: familyRows[0].id, memberDisplayName: null } : null;
}

export async function setJournalOptOut(familyId: string, out: boolean): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set journal_opt_out_at = ${out ? new Date().toISOString() : null}
    where id = ${familyId}
  `;
}
