import {
  APPLE_NEW_PURCHASE_PRODUCT_IDS,
  APPLE_NEW_PURCHASE_PRODUCTS,
} from "@homa/core";

export {
  APPLE_PRODUCT_IDS,
  APPLE_PROVIDER_PRODUCTS,
  HOMA_PLANS,
  PURCHASABLE_HOMA_PLANS,
  planDefinition,
  weeklyEquivalentUsd,
  type BillingPeriod,
  type PlanTier,
} from "@homa/core";

/**
 * Products currently merchandised on the native iOS paywall.
 *
 * Keep this separate from APPLE_PRODUCT_IDS. The full catalog remains the
 * permanent receipt-verification allowlist, while the iOS offer is
 * deliberately monthly-only (ios-monthly-only-launch 2026-08-01,
 * reaffirmed by the founder 2026-08-31 when overruling walk-v2 D3) and
 * can change without invalidating old receipts.
 */
export const APPLE_NATIVE_PROVIDER_PRODUCTS = APPLE_NEW_PURCHASE_PRODUCTS;

export const APPLE_NATIVE_PRODUCT_IDS = APPLE_NEW_PURCHASE_PRODUCT_IDS;
