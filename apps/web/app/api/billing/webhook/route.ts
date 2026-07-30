import Stripe from "stripe";

import { TIER_NAMES } from "../../../../components/billing/wall-copy";
import {
  formatTrialCharge,
  formatTrialEndDate,
  trialReminderContent,
  trialReminderVerdict,
} from "../../../../lib/billing/trial-reminder";
import {
  familyForStripeCustomer,
  recordFamilySubscription,
  startFamilyTrial,
  tierForStripeProductRecognized,
} from "../../../../lib/billing/wall";
import { mapDb } from "../../../../lib/map/db";
import {
  siteUrl,
  submitTrialReminderEmail,
  trialReminderAlreadySent,
} from "../../../../lib/map/email";
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
  // || not ??: an empty LIVE var (a dev environment shadowing the live
  // key) must fall through to TEST, matching paymentLinkBases.
  const secretKey = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY;
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
        // Stamp the mirror by FAMILY id too: the subscription.created
        // event for this checkout matched zero rows whenever it arrived
        // before this handler pinned the (possibly brand-new) customer
        // id, which would leave a re-subscribing family walled on its
        // stale "canceled" status (see recordFamilySubscription).
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        // Resolve the tier BEFORE stamping the trial (gh#298). This
        // handler used to pass no tier at all, on the reasoning that a
        // checkout session carries no expanded line items, and leave
        // plan_tier to the confirm route the buyer lands on afterwards.
        // That is a promise the buyer does not have to keep: close the
        // tab on the Stripe receipt and the confirm route never runs, so
        // a family who paid for Plus keeps whatever tier she had. Harmless
        // while nothing reads plan_tier, and the moment the channel gate
        // turns on it means denying text, phone, and email to someone who
        // just bought exactly those. The subscription this handler
        // already retrieves names its own product, so the tier is here
        // for the asking.
        let subscription: Stripe.Subscription | null = null;
        if (subscriptionId) {
          subscription = await stripe.subscriptions.retrieve(subscriptionId);
        }
        const purchasedProduct = subscription?.items.data[0]?.price.product ?? null;
        // Recognized-only: an unmapped product must leave plan_tier
        // untouched, never resolve to "regular", because plan_tier is
        // written with coalesce and "regular" would downgrade a Plus
        // family whose confirm route already ran.
        const purchasedTier =
          typeof purchasedProduct === "string"
            ? tierForStripeProductRecognized(purchasedProduct)
            : null;

        const fresh = await startFamilyTrial(familyId, customerId, purchasedTier);
        if (fresh) {
          await emitMapEvent("billing.trial_started", { family_id: familyId });
        }
        if (subscription) {
          await recordFamilySubscription(familyId, {
            id: subscription.id,
            status: subscription.status,
            priceId: subscription.items.data[0]?.price.id ?? null,
            currentPeriodEndSec: subscription.items.data[0]?.current_period_end ?? null,
          });
        }
        break;
      }
      case "customer.subscription.trial_will_end": {
        // The Day 4 promise in TRIAL_GATE_TIMELINE, kept. Stripe fires
        // this 3 days before trial end at any trial length, which is
        // why the copy names day 4 of 7 rather than the day-23 framing
        // the old 30-day trial used.
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === "string" ? subscription.customer : null;
        if (!customerId) break;
        const family = await familyForStripeCustomer(customerId);
        const item = subscription.items.data[0];
        const verdict = trialReminderVerdict(
          family
            ? {
                id: family.id,
                email: family.email,
                firstName: family.firstName,
                planName: TIER_NAMES[family.planTier],
                timeZone: family.timeZone,
                billingExempt: family.billingExempt,
              }
            : null,
          {
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
            trialEndSec: subscription.trial_end ?? null,
            amountCents: item?.price.unit_amount ?? null,
            currency: item?.price.currency ?? null,
            interval: item?.price.recurring?.interval ?? null,
          },
          family ? await trialReminderAlreadySent(family.id) : false,
        );
        if (!verdict.send || !family) {
          console.log(
            `billing/webhook: trial reminder skipped (${verdict.send ? "no-family" : verdict.reason}) for customer ${customerId}`,
          );
          break;
        }
        const submission = await submitTrialReminderEmail(
          verdict.to,
          trialReminderContent({
            firstName: family.firstName,
            planName: TIER_NAMES[family.planTier],
            endDate: formatTrialEndDate(subscription.trial_end ?? null, family.timeZone),
            charge: formatTrialCharge(
              item?.price.unit_amount ?? null,
              item?.price.currency ?? null,
              item?.price.recurring?.interval ?? null,
            ),
            manageUrl: `${siteUrl()}/api/billing/portal`,
          }),
          family.id,
        );
        if (submission.status === "submitted") {
          await emitMapEvent("billing.trial_reminder_sent", { family_id: family.id });
          break;
        }
        // "rejected" is Resend refusing this address for good: retrying
        // cannot help, so acknowledge. "unknown" is a timeout or a 5xx,
        // where the ledger row records no successful send, so a 500 here
        // lets Stripe's retry try the send again.
        console.error(
          `billing/webhook: trial reminder ${submission.status} for family ${family.id}`,
        );
        if (submission.status === "unknown") {
          return Response.json({ ok: false, reason: "reminder-retry" }, { status: 500 });
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
