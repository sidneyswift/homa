import {
  isBillingPeriod,
  isBillingProvider,
  isPlanTier,
  type BillingPeriod,
  type BillingProvider,
  type PlanTier,
} from "@homa/core";
import type { TransactionSql } from "postgres";

import { mapDb } from "../map/db";

/**
 * Provider-neutral subscription ledger.
 *
 * A family owns a Homa plan, not a Stripe or App Store plan. This module
 * translates independently verified provider records into that one product
 * truth. The legacy columns on families remain a compatibility mirror while
 * existing readers move here and while the migration backfills their history.
 */

export const LAPSED_BILLING_STATUSES = new Set([
  "canceled",
  "unpaid",
  "incomplete_expired",
  "paused",
]);

export interface BillingSubscriptionRecord {
  provider: BillingProvider;
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  providerProductId: string | null;
  tier: PlanTier;
  period: BillingPeriod | null;
  status: string;
  currentPeriodEnd: string | null;
  observedAt: string;
}

export interface FamilyBillingEntitlement {
  active: boolean;
  hasBillingHistory: boolean;
  provider: BillingProvider | null;
  tier: PlanTier;
  period: BillingPeriod | null;
  currentPeriodEnd: string | null;
}

const TIER_RANK: Record<PlanTier, number> = {
  regular: 1,
  plus: 2,
  elite: 3,
};

function subscriptionIsActive(status: string): boolean {
  return !LAPSED_BILLING_STATUSES.has(status);
}

/**
 * Reduce provider records with no database access. When an account somehow
 * has two live verified purchases, show the higher Homa tier. Normal UI gates
 * prevent a second checkout, but this protects entitlement from being
 * accidentally downgraded while a provider's cancellation is still in flight.
 */
export function entitlementFromSubscriptions(
  subscriptions: readonly BillingSubscriptionRecord[],
): FamilyBillingEntitlement | null {
  if (subscriptions.length === 0) return null;

  const active = subscriptions
    .filter((subscription) => subscriptionIsActive(subscription.status))
    .sort((left, right) => {
      const tierDifference = TIER_RANK[right.tier] - TIER_RANK[left.tier];
      if (tierDifference !== 0) return tierDifference;
      return Date.parse(right.observedAt) - Date.parse(left.observedAt);
    })[0];

  if (!active) {
    return {
      active: false,
      hasBillingHistory: true,
      provider: null,
      tier: "regular",
      period: null,
      currentPeriodEnd: null,
    };
  }

  return {
    active: true,
    hasBillingHistory: true,
    provider: active.provider,
    tier: active.tier,
    period: active.period,
    currentPeriodEnd: active.currentPeriodEnd,
  };
}

type BillingSubscriptionRow = {
  provider: string;
  provider_subscription_id: string;
  provider_customer_id: string | null;
  provider_product_id: string | null;
  plan_tier: string;
  billing_period: string | null;
  status: string;
  current_period_end: string | null;
  last_observed_at: string;
};

function subscriptionFromRow(row: BillingSubscriptionRow): BillingSubscriptionRecord | null {
  if (!isBillingProvider(row.provider) || !isPlanTier(row.plan_tier)) return null;
  return {
    provider: row.provider,
    providerSubscriptionId: row.provider_subscription_id,
    providerCustomerId: row.provider_customer_id,
    providerProductId: row.provider_product_id,
    tier: row.plan_tier,
    period: isBillingPeriod(row.billing_period) ? row.billing_period : null,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    observedAt: row.last_observed_at,
  };
}

/** Read the canonical entitlement for one authenticated family. */
export async function familyBillingEntitlement(
  familyId: string,
): Promise<FamilyBillingEntitlement | null> {
  const sql = mapDb();
  const rows = await sql<BillingSubscriptionRow[]>`
    select provider, provider_subscription_id, provider_customer_id,
           provider_product_id, plan_tier, billing_period, status,
           current_period_end::text as current_period_end,
           last_observed_at::text as last_observed_at
    from public.family_billing_subscriptions
    where family_id = ${familyId}
  `;
  return entitlementFromSubscriptions(
    rows.map(subscriptionFromRow).filter((row): row is BillingSubscriptionRecord => row !== null),
  );
}

/**
 * Upsert a verified provider observation. The uniqueness key is the
 * provider's stable subscription identity, so renewals and webhook retries
 * cannot duplicate entitlement rows.
 */
export async function recordBillingSubscription(
  familyId: string,
  subscription: Omit<BillingSubscriptionRecord, "observedAt"> & {
    observedAt?: string;
  },
): Promise<void> {
  const sql = mapDb();
  await sql.begin(async (tx) => {
    await recordBillingSubscriptionInTransaction(tx, familyId, subscription);
  });
}

/** Same monotonic provider write, participating in a caller-owned transaction. */
export async function recordBillingSubscriptionInTransaction(
  tx: TransactionSql,
  familyId: string,
  subscription: Omit<BillingSubscriptionRecord, "observedAt"> & {
    observedAt?: string;
  },
): Promise<void> {
  const observedAt = subscription.observedAt ?? new Date().toISOString();
  const rows = await tx<{ id: string }[]>`
    insert into public.family_billing_subscriptions (
      family_id, provider, provider_subscription_id, provider_customer_id,
      provider_product_id, plan_tier, billing_period, status,
      current_period_end, last_observed_at
    ) values (
      ${familyId}, ${subscription.provider}, ${subscription.providerSubscriptionId},
      ${subscription.providerCustomerId}, ${subscription.providerProductId},
      ${subscription.tier}, ${subscription.period}, ${subscription.status},
      ${subscription.currentPeriodEnd}, ${observedAt}
    )
    on conflict (provider, provider_subscription_id) do update
      set provider_customer_id = excluded.provider_customer_id,
          provider_product_id = excluded.provider_product_id,
          plan_tier = excluded.plan_tier,
          billing_period = excluded.billing_period,
          status = excluded.status,
          current_period_end = excluded.current_period_end,
          last_observed_at = excluded.last_observed_at,
          updated_at = now()
      where public.family_billing_subscriptions.family_id = excluded.family_id
        and public.family_billing_subscriptions.last_observed_at
          <= excluded.last_observed_at
    returning id
  `;
  if (rows[0]) return;

  const existing = await tx<Array<{ family_id: string; last_observed_at: string }>>`
    select family_id, last_observed_at::text as last_observed_at
    from public.family_billing_subscriptions
    where provider = ${subscription.provider}
      and provider_subscription_id = ${subscription.providerSubscriptionId}
    limit 1
  `;
  if (existing[0]?.family_id === familyId) return;
  throw new Error("billing subscription is already linked to a different family");
}
