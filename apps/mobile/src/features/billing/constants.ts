import {
  APPLE_PROVIDER_PRODUCTS as ALL_APPLE_PROVIDER_PRODUCTS,
  planAvailableForPurchase,
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
 * permanent receipt-verification allowlist, while the initial iOS offer is
 * deliberately monthly-only and can change without invalidating old receipts.
 */
export const APPLE_NATIVE_PROVIDER_PRODUCTS = ALL_APPLE_PROVIDER_PRODUCTS.filter(
  (product) => product.period === "monthly" && planAvailableForPurchase(product.tier),
);

export const APPLE_NATIVE_PRODUCT_IDS = APPLE_NATIVE_PROVIDER_PRODUCTS.map(
  (product) => product.productId,
);
