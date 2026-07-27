import { mapDb } from "./map/db";

/**
 * The SMS suppression store (morning-brief conversion escalation,
 * 2026-07-23). Durable internal record of numbers Homa must not text:
 * inbound carrier opt-out keywords, and Telnyx permanent rejections
 * (40300 recipient opted out, 40309 invalid destination number). Telnyx
 * already blocks STOP'd numbers at the platform level; this store
 * records the same fact internally so the dispatcher skips suppressed
 * numbers instead of burning an agent run into a guaranteed rejection
 * on every daily cycle.
 *
 * Every function is best-effort by the same law as the email store
 * (lib/email/suppression.ts): a suppression read or write must never
 * break the send it guards. A read failure (including the table not
 * existing yet if a deploy ever leads its migration) resolves to "not
 * suppressed", which falls back to Telnyx's own carrier enforcement,
 * exactly the pre-store behavior.
 */

export interface SmsSuppression {
  reason: string;
}

/** The injectable surface task delivery uses; the postgres store below
 * is the production wiring, tests substitute an in-memory one. */
export interface SmsSuppressionStore {
  find(phoneE164: string): Promise<SmsSuppression | null>;
  suppress(phoneE164: string, reason: string): Promise<void>;
}

export async function suppressSmsNumber(
  phoneE164: string,
  reason: string,
): Promise<void> {
  try {
    const sql = mapDb();
    await sql`
      insert into public.sms_suppressions (phone_e164, reason)
      values (${phoneE164}, ${reason})
      on conflict (phone_e164)
      do update set reason = excluded.reason, updated_at = now()
    `;
  } catch (error) {
    console.error("sms suppression write failed:", error);
  }
}

/** Lifts a suppression: an inbound START/UNSTOP. If the number was
 * suppressed as invalid and truly is, the next send re-suppresses it. */
export async function unsuppressSmsNumber(phoneE164: string): Promise<void> {
  try {
    const sql = mapDb();
    await sql`
      delete from public.sms_suppressions where phone_e164 = ${phoneE164}
    `;
  } catch (error) {
    console.error("sms suppression delete failed:", error);
  }
}

export async function findSmsSuppression(
  phoneE164: string,
): Promise<SmsSuppression | null> {
  try {
    const sql = mapDb();
    const rows = await sql<{ reason: string }[]>`
      select reason from public.sms_suppressions
      where phone_e164 = ${phoneE164}
    `;
    return rows[0] ? { reason: rows[0].reason } : null;
  } catch (error) {
    console.error("sms suppression read failed:", error);
    return null;
  }
}

export const postgresSmsSuppressionStore: SmsSuppressionStore = {
  find: findSmsSuppression,
  suppress: suppressSmsNumber,
};

/**
 * Carrier opt-out keywords are protocol, not conversation: the exact
 * single-word commands carriers and Telnyx themselves match
 * deterministically before blocking the number. Matching them here is
 * the models-judge law's narrow exception (verification, not
 * interpretation): a keyword counts only when it is the entire message,
 * so "please stop sending briefs" stays a sentence for the agent.
 */
const SMS_OPT_OUT_KEYWORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
]);
const SMS_OPT_IN_KEYWORDS = new Set(["start", "unstop"]);

export type SmsOptKeywordAction = "stop" | "start";

export function classifySmsOptKeyword(input: {
  text: string;
  hasAttachments: boolean;
}): SmsOptKeywordAction | null {
  if (input.hasAttachments) return null;
  const normalized = input.text.trim().toLowerCase();
  if (SMS_OPT_OUT_KEYWORDS.has(normalized)) return "stop";
  if (SMS_OPT_IN_KEYWORDS.has(normalized)) return "start";
  return null;
}
