import {
  applyResendWebhookReceiptWithDatabase,
  classifyResendWebhook,
  resendWebhookReceiptHttpStatus,
  verifySvixSignature,
} from "../../../../lib/email-webhook";
import { mapDb } from "../../../../lib/map/db";
import { operationalDiagnostic } from "../../../../lib/operational-diagnostics";

/**
 * POST /api/email/webhook  (Resend webhook endpoint, founder console MJ-14)
 * Delivery receipts for every email Resend sends on our behalf. Two
 * ledgers learn from it, both keyed by Resend's submission id:
 *   1. email_sends (map-flow ledger): submitted rows upgrade to
 *      delivered / bounced / complained.
 *   2. conversation_deliveries (task sends): a hard bounce escalates the
 *      matching row to failed so the tasks tab and the founder console
 *      stop claiming a send that never landed.
 * DARK until RESEND_WEBHOOK_SECRET is set (Resend dashboard: create the
 * endpoint, copy its whsec_ signing secret). Signature is svix HMAC;
 * verification is pure code in lib/email-webhook.ts, tested by
 * pnpm check:admin.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const payload = await request.text();
  const verified = verifySvixSignature(secret, {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  }, payload);
  if (!verified) {
    return Response.json({ ok: false, reason: "bad-signature" }, { status: 401 });
  }

  let event: { type?: unknown; data?: { email_id?: unknown } };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const type = typeof event.type === "string" ? event.type : "";
  const emailId = typeof event.data?.email_id === "string" ? event.data.email_id : null;
  const action = classifyResendWebhook(type);
  if (!emailId || !action.ledgerStatus) return Response.json({ ok: true, ignored: true });

  try {
    const sql = mapDb();
    const result = await applyResendWebhookReceiptWithDatabase(sql, {
      emailId,
      eventType: type,
      ledgerStatus: action.ledgerStatus,
      failsDelivery: action.failsDelivery,
    });
    const status = resendWebhookReceiptHttpStatus(result);
    if (status !== 200) {
      return Response.json(
        { ok: false, reason: "receipt-not-yet-correlated" },
        { status },
      );
    }
  } catch {
    console.error(
      operationalDiagnostic("email_webhook", "finalization", "failed"),
    );
    // 500 asks Resend to retry, which both updates tolerate (idempotent).
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true });
}
