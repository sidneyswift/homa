import { classifyResendWebhook, verifySvixSignature } from "../../../../lib/email-webhook";
import { mapDb } from "../../../../lib/map/db";

/**
 * POST /api/email/webhook  (Resend webhook endpoint, founder console MJ-14)
 * Delivery receipts for every email Resend sends on our behalf. Two
 * ledgers learn from it, both keyed by the provider message id:
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
    // A delivered receipt must never overwrite a bounce that raced it.
    await sql`
      update public.email_sends
      set status = ${action.ledgerStatus},
          error = ${action.ledgerStatus === "delivered" ? null : type},
          updated_at = now()
      where provider_message_id = ${emailId}
        and (${action.ledgerStatus !== "delivered"} or status = 'submitted')
    `;
    if (action.failsDelivery) {
      await sql`
        update public.conversation_deliveries
        set status = 'failed',
            error = ${type},
            failed_at = now(),
            updated_at = now()
        where provider_message_id = ${emailId}
          and status in ('pending', 'sent', 'uncertain')
      `;
    }
  } catch (error) {
    console.error("email/webhook failed:", error instanceof Error ? error.message : "unknown");
    // 500 asks Resend to retry, which both updates tolerate (idempotent).
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true });
}
