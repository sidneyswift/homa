import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import Stripe from "stripe";

import { POST } from "../../app/api/billing/webhook/route";
import { mapDb } from "../map/db";

const FAMILY_A = "00000000-0000-4000-8000-000000000911";
const FAMILY_B = "00000000-0000-4000-8000-000000000912";
const WEBHOOK_SECRET = "whsec_duplicate_trial_stripe_e2e";
const TEST_KEY = process.env.STRIPE_TEST_SECRET_KEY;

describe("Stripe test-mode duplicate-trial webhook", { skip: !TEST_KEY }, () => {
  const sql = mapDb();
  const stripe = new Stripe(TEST_KEY ?? "sk_test_missing");
  let productId: string | null = null;
  let priceId: string | null = null;
  const customerIds: string[] = [];
  const subscriptionIds: string[] = [];
  const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const previousLiveKey = process.env.STRIPE_LIVE_SECRET_KEY;

  before(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_LIVE_SECRET_KEY = "";

    const product = await stripe.products.create({
      name: "Homa duplicate-trial guard E2E",
      metadata: { test: "duplicate-trial-guard" },
    });
    productId = product.id;
    const price = await stripe.prices.create({
      currency: "usd",
      product: product.id,
      recurring: { interval: "month" },
      unit_amount: 1900,
    });
    priceId = price.id;

    for (const familyId of [FAMILY_A, FAMILY_B]) {
      const customer = await stripe.customers.create({ metadata: { familyId } });
      customerIds.push(customer.id);
      const paymentMethod = await stripe.paymentMethods.create({
        type: "card",
        card: { token: "tok_visa" },
      });
      await stripe.paymentMethods.attach(paymentMethod.id, { customer: customer.id });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethod.id },
      });
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        default_payment_method: paymentMethod.id,
        items: [{ price: price.id }],
        trial_period_days: 7,
      });
      subscriptionIds.push(subscription.id);
    }

    await sql`
      insert into public.families (id, stripe_subscription_status)
      values (${FAMILY_A}, 'trialing'), (${FAMILY_B}, 'trialing')
    `;
  });

  after(async () => {
    await sql`delete from public.families where id in (${FAMILY_A}, ${FAMILY_B})`;
    await Promise.all(
      subscriptionIds.map(async (subscriptionId) => {
        try {
          await stripe.subscriptions.cancel(subscriptionId);
        } catch (error) {
          if (!(error instanceof Stripe.errors.StripeInvalidRequestError) || error.code !== "resource_missing") {
            throw error;
          }
        }
      }),
    );
    await Promise.all(customerIds.map((customerId) => stripe.customers.del(customerId)));
    if (priceId) await stripe.prices.update(priceId, { active: false });
    if (productId) await stripe.products.update(productId, { active: false });
    process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
    process.env.STRIPE_LIVE_SECRET_KEY = previousLiveKey;
  });

  async function deliverCheckoutCompleted(familyId: string, customerId: string, subscriptionId: string) {
    const payload = JSON.stringify({
      id: `evt_duplicate_trial_${familyId.slice(-4)}`,
      object: "event",
      api_version: "2026-06-30.basil",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: `cs_duplicate_trial_${familyId.slice(-4)}`,
          object: "checkout.session",
          client_reference_id: familyId,
          customer: customerId,
          subscription: subscriptionId,
        },
      },
      livemode: false,
      pending_webhooks: 1,
      type: "checkout.session.completed",
    });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    return await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
  }

  it("keeps the first test-mode trial and cancels a second family on the same card", async () => {
    const [customerA, customerB] = customerIds;
    const [subscriptionA, subscriptionB] = subscriptionIds;
    assert.ok(customerA && customerB && subscriptionA && subscriptionB);

    assert.equal((await deliverCheckoutCompleted(FAMILY_A, customerA, subscriptionA)).status, 200);
    assert.equal((await deliverCheckoutCompleted(FAMILY_B, customerB, subscriptionB)).status, 200);

    const secondSubscription = await stripe.subscriptions.retrieve(subscriptionB);
    assert.equal(secondSubscription.status, "canceled");
    const families = await sql<{ id: string; trial_started_at: Date | null }[]>`
      select id, trial_started_at
      from public.families
      where id in (${FAMILY_A}, ${FAMILY_B})
      order by id
    `;
    assert.ok(families.find((family) => family.id === FAMILY_A)?.trial_started_at);
    assert.equal(families.find((family) => family.id === FAMILY_B)?.trial_started_at, null);
  });
});
