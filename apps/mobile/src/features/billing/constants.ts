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
 * permanent receipt-verification allowlist, while the current iOS offer
 * (monthly plus the D3-ruled annual, 2026-08-31) can change without
 * invalidating old receipts. Paywall surfaces render only the products
 * the App Store actually returns, so a product listed here but not yet
 * created in App Store Connect simply does not appear.
 */
export const APPLE_NATIVE_PROVIDER_PRODUCTS = APPLE_NEW_PURCHASE_PRODUCTS;

export const APPLE_NATIVE_PRODUCT_IDS = APPLE_NEW_PURCHASE_PRODUCT_IDS;
