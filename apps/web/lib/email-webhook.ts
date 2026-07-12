import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend webhook verification and classification (founder console, MJ-14).
 * Resend signs webhooks with svix: the signed content is
 * "{svix-id}.{svix-timestamp}.{raw body}", the key is the base64 part of
 * the whsec_ secret, and the svix-signature header holds space-separated
 * "v1,<base64 hmac>" candidates. Pure functions so the check is testable
 * without a server (pnpm check:admin).
 */

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/** Webhooks older or newer than this are replays or clock trouble. */
const TOLERANCE_SECONDS = 5 * 60;

export function verifySvixSignature(
  secret: string,
  headers: SvixHeaders,
  payload: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.timestamp}.${payload}`)
    .digest();

  return headers.signature.split(" ").some((candidate) => {
    const [version, signature] = candidate.split(",", 2);
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** What one Resend event type means for the ledgers. ledgerStatus updates
 * email_sends; failsDelivery escalates a matching conversation_deliveries
 * row to failed (hard bounces only: a complaint was still delivered). */
export interface ResendWebhookAction {
  ledgerStatus: "delivered" | "bounced" | "complained" | null;
  failsDelivery: boolean;
}

export function classifyResendWebhook(type: string): ResendWebhookAction {
  switch (type) {
    case "email.delivered":
      return { ledgerStatus: "delivered", failsDelivery: false };
    case "email.bounced":
      return { ledgerStatus: "bounced", failsDelivery: true };
    case "email.complained":
      return { ledgerStatus: "complained", failsDelivery: false };
    default:
      // sent/opened/clicked/delivery_delayed: nothing durable to record.
      return { ledgerStatus: null, failsDelivery: false };
  }
}
