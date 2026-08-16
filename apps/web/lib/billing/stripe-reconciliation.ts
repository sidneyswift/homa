import Stripe from "stripe";
import type { Sql } from "postgres";

import { mapDb } from "../map/db";
import { configuredStripeSecretKey } from "./stripe-checkout-config";
import {
  billingPeriodForStripeInterval,
  recordFamilySubscription,
  tierForStripeProductRecognized,
} from "./wall";

/**
 * Stripe is the authority for subscription state. Webhooks keep Homa's
 * compatibility mirror current in the normal path; this bounded sweep repairs
 * that mirror when its paid-through date says a webhook may have gone quiet.
 *
 * A local clock never revokes access. The sweep retrieves the exact Stripe
 * subscription first, then sends that verified observation through the same
 * writer used by checkout confirmation and webhooks. A failed provider read
 * changes nothing, which protects a paying family from a false lockout.
 */

const STALE_GRACE_DAYS = 2;
const TRIAL_WINDOW_DAYS = 8;
const MAX_RECONCILIATIONS_PER_RUN = 10;

export interface StripeReconciliationCandidate {
  familyId: string;
  subscriptionId: string | null;
  customerId: string | null;
}

export interface StripeReconciliationResult {
  considered: number;
  reconciled: number;
  lapsed: number;
  unresolved: number;
  failed: number;
}

export interface StripeReconciliationGateway {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  listCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]>;
}

type SubscriptionObservation = Parameters<typeof recordFamilySubscription>[1];

/**
 * Candidates are server-owned billing records only. The two-day grace keeps a
 * normal renewal or Stripe retry out of the sweep. The eight-day fallback
 * catches an old trial whose subscription id was never mirrored, but only
 * when a customer id gives Stripe an exact relationship to inspect.
 */
export async function findStripeReconciliationCandidates(
  database: Sql,
  now: Date,
  limit = MAX_RECONCILIATIONS_PER_RUN,
): Promise<StripeReconciliationCandidate[]> {
  const rows = await database<
    Array<{
      family_id: string;
      stripe_subscription_id: string | null;
      stripe_customer_id: string | null;
    }>
  >`
    select id as family_id, stripe_subscription_id, stripe_customer_id
    from public.families
    where coalesce(status, 'open') <> 'deleted'
      and not sandbox
      and not billing_exempt
      and (
        (
          stripe_subscription_id is not null
          and (
            stripe_subscription_status is null
            or (
              stripe_subscription_status not in ('canceled', 'unpaid', 'incomplete_expired', 'paused')
              and stripe_current_period_end is not null
              and stripe_current_period_end < ${now.toISOString()}::timestamptz
                - ${`${STALE_GRACE_DAYS} days`}::interval
            )
            or (
              stripe_subscription_status = 'trialing'
              and trial_started_at is not null
              and trial_started_at < ${now.toISOString()}::timestamptz
                - ${`${TRIAL_WINDOW_DAYS} days`}::interval
            )
          )
        )
        or (
          stripe_subscription_id is null
          and stripe_customer_id is not null
          and trial_started_at is not null
          and trial_started_at < ${now.toISOString()}::timestamptz
            - ${`${TRIAL_WINDOW_DAYS} days`}::interval
        )
      )
    order by coalesce(stripe_current_period_end, trial_started_at, created_at), id
    limit ${limit}
  `;
  return rows.map((row) => ({
    familyId: row.family_id,
    subscriptionId: row.stripe_subscription_id,
    customerId: row.stripe_customer_id,
  }));
}

/** Normalize one verified Stripe response for Homa's existing writer. */
export function stripeSubscriptionObservation(
  subscription: Stripe.Subscription,
): SubscriptionObservation {
  const item = subscription.items.data[0];
  const product = item?.price.product ?? null;
  const productId = typeof product === "string" ? product : product?.id ?? null;
  const customer = subscription.customer;
  const customerId = typeof customer === "string" ? customer : customer?.id ?? null;
  return {
    id: subscription.id,
    status: subscription.status,
    priceId: item?.price.id ?? null,
    productId,
    customerId,
    tier: tierForStripeProductRecognized(productId),
    period: billingPeriodForStripeInterval(item?.price.recurring?.interval ?? null),
    currentPeriodEndSec: item?.current_period_end ?? null,
  };
}

/**
 * A customer can have historical canceled subscriptions beside one current
 * relationship. Select only when Stripe gives one unambiguous current record,
 * or one record total. Ambiguity changes nothing and stays visible as
 * unresolved rather than guessing which purchase owns access.
 */
export function selectCustomerSubscription(
  subscriptions: readonly Stripe.Subscription[],
): Stripe.Subscription | null {
  const current = subscriptions.filter(
    (subscription) =>
      !["canceled", "unpaid", "incomplete_expired", "paused"].includes(
        subscription.status,
      ),
  );
  if (current.length === 1) return current[0] ?? null;
  if (current.length === 0 && subscriptions.length === 1) {
    return subscriptions[0] ?? null;
  }
  return null;
}

function stripeGateway(): StripeReconciliationGateway {
  const secretKey = configuredStripeSecretKey();
  if (!secretKey) {
    throw new Error("billing reconciliation: Stripe secret key is not configured");
  }
  const stripe = new Stripe(secretKey, { maxNetworkRetries: 1, timeout: 10_000 });
  return {
    retrieveSubscription: async (id) => await stripe.subscriptions.retrieve(id),
    listCustomerSubscriptions: async (customerId) => {
      const page = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      return page.data;
    },
  };
}

export async function reconcileStaleStripeSubscriptions(
  options: {
    now?: Date;
    database?: Sql;
    find?: typeof findStripeReconciliationCandidates;
    gateway?: StripeReconciliationGateway;
    record?: typeof recordFamilySubscription;
  } = {},
): Promise<StripeReconciliationResult> {
  const now = options.now ?? new Date();
  const database = options.database ?? mapDb();
  const find = options.find ?? findStripeReconciliationCandidates;
  const candidates = await find(database, now, MAX_RECONCILIATIONS_PER_RUN);
  const result: StripeReconciliationResult = {
    considered: candidates.length,
    reconciled: 0,
    lapsed: 0,
    unresolved: 0,
    failed: 0,
  };
  if (candidates.length === 0) return result;

  const gateway = options.gateway ?? stripeGateway();
  const record = options.record ?? recordFamilySubscription;
  for (const candidate of candidates) {
    try {
      const subscription = candidate.subscriptionId
        ? await gateway.retrieveSubscription(candidate.subscriptionId)
        : candidate.customerId
          ? selectCustomerSubscription(
              await gateway.listCustomerSubscriptions(candidate.customerId),
            )
          : null;
      if (!subscription) {
        result.unresolved += 1;
        continue;
      }
      const observation = stripeSubscriptionObservation(subscription);
      await record(candidate.familyId, observation);
      result.reconciled += 1;
      if (["canceled", "unpaid", "incomplete_expired", "paused"].includes(observation.status)) {
        result.lapsed += 1;
      }
    } catch (error) {
      result.failed += 1;
      console.error(
        `billing reconciliation failed for family ${candidate.familyId}:`,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  return result;
}
