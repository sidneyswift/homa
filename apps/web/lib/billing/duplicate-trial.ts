import Stripe from "stripe";

import { mapDb } from "../map/db";

const EXPLICITLY_LAPSED_STRIPE_STATUSES = [
  "canceled",
  "unpaid",
  "incomplete_expired",
  "paused",
] as const;

export type StripeTrialCardClaim = "claimed" | "duplicate";

export type StripeTrialGuardResult = "claimed" | "duplicate" | "not-a-card";

function paymentMethodId(
  paymentMethod: string | Stripe.PaymentMethod | null | undefined,
): string | null {
  if (typeof paymentMethod === "string") return paymentMethod;
  return paymentMethod?.id ?? null;
}

function paymentMethodFingerprint(paymentMethod: Stripe.PaymentMethod): string | null {
  return paymentMethod.type === "card" ? paymentMethod.card?.fingerprint ?? null : null;
}

async function paymentMethodForSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<Stripe.PaymentMethod | null> {
  const subscriptionPaymentMethod = paymentMethodId(subscription.default_payment_method);
  if (subscriptionPaymentMethod) {
    return await stripe.paymentMethods.retrieve(subscriptionPaymentMethod);
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (customer.deleted) return null;

  const customerPaymentMethod = paymentMethodId(customer.invoice_settings.default_payment_method);
  return customerPaymentMethod ? await stripe.paymentMethods.retrieve(customerPaymentMethod) : null;
}

/**
 * The fingerprint is Stripe's exact, provider-owned signal that two card
 * payment methods represent the same card number. It is intentionally never
 * returned to a client or emitted as an event property.
 */
export async function stripeTrialCardFingerprint(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const paymentMethod = await paymentMethodForSubscription(stripe, subscription);
  return paymentMethod ? paymentMethodFingerprint(paymentMethod) : null;
}

/**
 * Atomically claim an active trial card for one family. A claim may move only
 * after its prior Stripe subscription explicitly lapsed, so two overlapping
 * families cannot both make a future charge against the same card.
 */
export async function claimStripeTrialCard(
  familyId: string,
  fingerprint: string,
): Promise<StripeTrialCardClaim> {
  const sql = mapDb();
  const claimed = await sql<{ family_id: string }[]>`
    insert into public.stripe_trial_card_claims as claims (card_fingerprint, family_id)
    values (${fingerprint}, ${familyId})
    on conflict (card_fingerprint) do update
      set family_id = excluded.family_id,
          updated_at = now()
      where claims.family_id = excluded.family_id
         or exists (
           select 1
           from public.families owner
           where owner.id = claims.family_id
             and owner.stripe_subscription_status in (
               ${EXPLICITLY_LAPSED_STRIPE_STATUSES[0]},
               ${EXPLICITLY_LAPSED_STRIPE_STATUSES[1]},
               ${EXPLICITLY_LAPSED_STRIPE_STATUSES[2]},
               ${EXPLICITLY_LAPSED_STRIPE_STATUSES[3]}
             )
         )
    returning family_id
  `;
  if (claimed[0]?.family_id === familyId) return "claimed";

  const owner = await sql<{ family_id: string }[]>`
    select family_id
    from public.stripe_trial_card_claims
    where card_fingerprint = ${fingerprint}
    limit 1
  `;
  if (owner[0]) return "duplicate";
  throw new Error("Stripe trial card claim disappeared before it could be resolved");
}

/** Cancellation is idempotent from Homa's perspective because Stripe can
 * deliver the webhook after a prior retry has already stopped the trial. */
export async function cancelDuplicateStripeTrial(
  stripe: Stripe,
  subscriptionId: string,
): Promise<void> {
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError) || error.code !== "resource_missing") {
      throw error;
    }
  }
}

/**
 * Enforce the provider-level guard before Homa stamps local entitlement. A
 * missing or non-card method is not a duplicate verdict: exact card signals
 * can prevent an error, but must never become identity inference.
 */
export async function enforceStripeTrialCardUniqueness(
  stripe: Stripe,
  familyId: string,
  subscription: Stripe.Subscription,
): Promise<StripeTrialGuardResult> {
  const fingerprint = await stripeTrialCardFingerprint(stripe, subscription);
  if (!fingerprint) return "not-a-card";

  const claim = await claimStripeTrialCard(familyId, fingerprint);
  if (claim === "claimed") return "claimed";

  await cancelDuplicateStripeTrial(stripe, subscription.id);
  return "duplicate";
}
