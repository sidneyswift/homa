import { createHmac, timingSafeEqual } from "node:crypto";

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
  messageId: string | null;
  inReplyTo: string | null;
  toEmails: string[];
  authenticationResults: string | null;
}

export interface InboundEmailEvent {
  emailId: string;
  fromEmail: string | null;
  subject: string;
  messageId: string | null;
}

const SVIX_TOLERANCE_SECONDS = 5 * 60;

function svixHeader(headers: Headers, name: "id" | "timestamp" | "signature"): string | null {
  return headers.get(`svix-${name}`) ?? headers.get(`webhook-${name}`);
}

export function verifyResendWebhookSignature(
  payload: string,
  headers: Headers,
  webhookSecret: string | null | undefined,
): boolean {
  if (!webhookSecret) return false;
  const id = svixHeader(headers, "id");
  const timestamp = svixHeader(headers, "timestamp");
  const signatures = svixHeader(headers, "signature");
  if (!id || !timestamp || !signatures) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > SVIX_TOLERANCE_SECONDS) return false;

  const secretPart = webhookSecret.startsWith("whsec_")
    ? webhookSecret.slice("whsec_".length)
    : webhookSecret;
  const secretBytes = Buffer.from(secretPart, "base64");
  if (secretBytes.length === 0) return false;

  const expected = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${payload}`)
    .digest();

  for (const candidate of signatures.split(/\s+/)) {
    const [version, value] = candidate.split(",", 2);
    if (version !== "v1" || !value) continue;
    const actual = Buffer.from(value, "base64");
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      return true;
    }
  }
  return false;
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

  const headers = new Map<string, string>();
  const rawHeaders = data.headers;
  if (rawHeaders && !Array.isArray(rawHeaders) && typeof rawHeaders === "object") {
    for (const [name, value] of Object.entries(rawHeaders)) {
      if (typeof value === "string") headers.set(name.toLowerCase(), value);
    }
  } else if (Array.isArray(rawHeaders)) {
    for (const header of rawHeaders) {
      if (!header || typeof header !== "object") continue;
      const name = (header as { name?: unknown }).name;
      const value = (header as { value?: unknown }).value;
      if (typeof name === "string" && typeof value === "string") {
        headers.set(name.toLowerCase(), value);
      }
    }
  }

  return {
    fromEmail,
    subject,
    text: stripReplyTail(text).trim(),
    messageId: headers.get("message-id") ?? null,
    inReplyTo: headers.get("in-reply-to") ?? null,
    toEmails: Array.isArray(data.to)
      ? data.to.filter((value): value is string => typeof value === "string")
      : typeof data.to === "string"
        ? [data.to]
        : [],
    authenticationResults: headers.get("authentication-results") ?? null,
  };
}

export function parseInboundEmailEvent(body: unknown): InboundEmailEvent | null {
  const event = (body ?? {}) as {
    type?: unknown;
    data?: Record<string, unknown>;
  };
  if (event.type !== "email.received" || !event.data) return null;
  const emailId = event.data.email_id;
  if (typeof emailId !== "string" || emailId.length === 0) return null;
  const from =
    typeof event.data.from === "string"
      ? event.data.from.trim().toLowerCase()
      : null;
  return {
    emailId,
    fromEmail: from || null,
    subject:
      typeof event.data.subject === "string" ? event.data.subject : "",
    messageId:
      typeof event.data.message_id === "string"
        ? event.data.message_id
        : null,
  };
}

export async function retrieveInboundEmail(
  emailId: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InboundEmail> {
  const response = await fetchImpl(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Resend receiving GET failed: HTTP ${response.status}`);
  }
  return parseInboundEmail(await response.json());
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
  /** Stable adult identity when the sender is a signed-in member. */
  memberUserId: string | null;
  /** The member's display name when the address matched a member's
   * sign-in email; null when only the family-level address matched. */
  memberDisplayName: string | null;
}

/** Resolves a registered parent email to its family, plus WHICH adult
 * wrote in when the address is a member's own. */
export async function findFamilyIdentityByEmail(
  email: string,
): Promise<FamilyEmailIdentity | null> {
  const sql = mapDb();
  const normalized = email.toLowerCase();
  const rows = await sql<
    { family_id: string; member_user_id: string; display_name: string | null }[]
  >`
    select m.family_id, m.user_id as member_user_id, m.display_name
    from public.family_members m
    join auth.users u on u.id = m.user_id
    where lower(u.email) = ${normalized}
    limit 1
  `;
  if (rows[0]) {
    return {
      familyId: rows[0].family_id,
      memberUserId: rows[0].member_user_id,
      memberDisplayName: rows[0].display_name,
    };
  }
  const familyRows = await sql<{ id: string }[]>`
    select id from public.families where lower(email) = ${normalized} limit 1
  `;
  return familyRows[0]
    ? {
        familyId: familyRows[0].id,
        memberUserId: null,
        memberDisplayName: null,
      }
    : null;
}

export async function setJournalOptOut(familyId: string, out: boolean): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.families
    set journal_opt_out_at = ${out ? new Date().toISOString() : null}
    where id = ${familyId}
  `;
}
