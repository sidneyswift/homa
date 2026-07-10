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

/** The family that registered this exact address, or null. */
export async function findFamilyIdByEmail(email: string): Promise<string | null> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    select id from public.families where lower(email) = ${email.toLowerCase()} limit 1
  `;
  return rows[0]?.id ?? null;
}

export async function setJournalOptOut(familyId: string, out: boolean): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set journal_opt_out_at = ${out ? new Date().toISOString() : null}
    where id = ${familyId}
  `;
}
