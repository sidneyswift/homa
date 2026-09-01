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
 * permanent receipt-verification allowlist, while the iOS offer is regular
 * monthly plus annual (ios-headspace-pricing 2026-09-01: $9.99/mo with a
 * 7-day trial, $99.99/yr with a 14-day trial, annual default) and can
 * change without invalidating old receipts. Prices render from StoreKit,
 * never from constants.
 */
export const APPLE_NATIVE_PROVIDER_PRODUCTS = APPLE_NEW_PURCHASE_PRODUCTS;

export const APPLE_NATIVE_PRODUCT_IDS = APPLE_NEW_PURCHASE_PRODUCT_IDS;
