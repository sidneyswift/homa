import Stripe from "stripe";

import { mapDb } from "../map/db";

/**
 * The Stripe customer billing portal: self-serve cancel, payment method
 * update, invoice history. Until this shipped (2026-07-25), the wall's
 * own copy said "Cancel anytime." (wall-copy.ts WALL_BULLETS) with no
 * mechanism behind it; a family could only cancel by asking the founder
 * to do it by hand in the Stripe dashboard. Live portal configuration
 * bpc_1TwzCzGnIMAiH0MJSR1Hwi8w (cancel takes effect at period end, no
 * refund for remaining days, matching Stripe's own default and how
 * "cancel anytime" reads to a customer) created the same day, before any
 * family had a live subscription to be affected by the gap.
 */

function stripeSecretKey(): string | null {
  // || not ??, matching wall.ts/billing-confirm: an empty LIVE var (a dev
  // environment shadowing the live key) must fall through to TEST.
  return process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || null;
}

async function familyStripeCustomerId(familyId: string): Promise<string | null> {
  const sql = mapDb();
  const rows = await sql<{ stripe_customer_id: string | null }[]>`
    select stripe_customer_id from public.families where id = ${familyId}
  `;
  return rows[0]?.stripe_customer_id ?? null;
}

/** True once this family has ever become a Stripe customer (a trial or a
 *  paid subscription), so settings can show the billing link only to
 *  families who actually have something to manage. */
export async function familyHasBillingRelationship(familyId: string): Promise<boolean> {
  return (await familyStripeCustomerId(familyId)) !== null;
}

/**
 * familyBillingPortalUrl(familyId, returnUrl): a one-time Stripe portal
 * URL for this family's own customer, or null if there is nothing to
 * manage yet or the Stripe call fails. Never throws: billing must never
 * take a family's settings page down.
 */
export async function familyBillingPortalUrl(
  familyId: string,
  returnUrl: string,
): Promise<string | null> {
  const customerId = await familyStripeCustomerId(familyId);
  if (!customerId) return null;

  const secretKey = stripeSecretKey();
  if (!secretKey) {
    console.error("billing/portal: no Stripe secret key configured");
    return null;
  }

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  } catch (error) {
    console.error(
      "billing/portal: session create failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
