import Stripe from "stripe";

import { startFamilyTrial } from "../../../../lib/billing/wall";
import { mapDb } from "../../../../lib/map/db";
import { emitMapEvent } from "../../../../lib/map/events";

/**
 * POST /api/billing/webhook  (Stripe webhook endpoint, founder console MJ-14)
 * Billing truth finally lands in Postgres instead of living only in the
 * Stripe dashboard (blind spot 2 in the 2026-07-12 founder-dashboard lab;
 * the confirm redirect stays the product unlock path and this webhook is
 * the safety net for the closed-tab checkout plus the subscription
 * lifecycle record the founder console reads).
 *
 *   checkout.session.completed  -> startFamilyTrial (idempotent; fires
 *     billing.trial_started only on the first stamp, exactly like the
 *     confirm route), and pins stripe_customer_id.
 *   customer.subscription.*     -> mirrors id/status/price/period end
 *     onto the families row matched by stripe_customer_id.
 *
 * DARK until STRIPE_WEBHOOK_SECRET is set (Stripe dashboard: add the
 * endpoint, copy its whsec_ secret). Never throws into Stripe retries
 * for unknown families: a session without a client_reference_id we
 * recognize is logged and acknowledged.
 */
export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_LIVE_SECRET_KEY ?? process.env.STRIPE_TEST_SECRET_KEY;
  if (!webhookSecret || !secretKey) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ ok: false, reason: "no-signature" }, { status: 400 });

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error(
      "billing/webhook signature failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "bad-signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const familyId = session.client_reference_id;
        if (!familyId) {
          console.error(`billing/webhook: session ${session.id} has no client_reference_id`);
          break;
        }
        const customerId = typeof session.customer === "string" ? session.customer : null;
        const fresh = await startFamilyTrial(familyId, customerId);
        if (fresh) {
          await emitMapEvent("billing.trial_started", { family_id: familyId });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === "string" ? subscription.customer : null;
        if (!customerId) break;
        const periodEnd = subscription.items.data[0]?.current_period_end ?? null;
        const sql = mapDb();
        await sql`
          update public.families
          set stripe_subscription_id = ${subscription.id},
              stripe_subscription_status = ${subscription.status},
              stripe_price_id = ${subscription.items.data[0]?.price.id ?? null},
              stripe_current_period_end = ${periodEnd ? new Date(periodEnd * 1000) : null},
              billing_updated_at = now()
          where stripe_customer_id = ${customerId}
        `;
        break;
      }
      default:
        // Every other event type is acknowledged and ignored on purpose.
        break;
    }
  } catch (error) {
    console.error("billing/webhook failed:", error instanceof Error ? error.message : "unknown");
    // 500 asks Stripe to retry; every branch above is idempotent.
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ received: true });
}
