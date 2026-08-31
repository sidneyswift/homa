/**
 * Homa's commercial catalog, shared by web and native clients.
 *
 * A plan is Homa's promise to a family. Stripe, Apple, and Google are
 * collection rails for that same promise. Product ids are immutable once
 * sold, so this is the single source of truth that maps a provider receipt
 * back to a Homa plan.
 */

export const PLAN_TIERS = ["regular", "plus", "elite"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const BILLING_PERIODS = ["monthly", "annual"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const BILLING_PROVIDERS = ["stripe", "apple", "google"] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const PLAN_SALES_STATES = ["available", "coming_soon"] as const;
export type PlanSalesState = (typeof PLAN_SALES_STATES)[number];

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  monthlyUsd: number;
  annualUsd: number;
  salesState: PlanSalesState;
}

/**
 * The public Homa plans. Regular's annual price is the founder-ruled
 * $119/year ($9.92 a month, save 48%; D3, 2026-08-31, mobile onboarding
 * + paywall v2 spec), the same on every platform (D11). The coming_soon
 * tiers keep the older twenty-percent-below-monthly convention until
 * they are actually priced for sale.
 */
export const HOMA_PLANS: readonly PlanDefinition[] = [
  { tier: "regular", name: "Homa", monthlyUsd: 19, annualUsd: 119, salesState: "available" },
  { tier: "plus", name: "Homa Plus", monthlyUsd: 49, annualUsd: 470, salesState: "coming_soon" },
  { tier: "elite", name: "Homa Max", monthlyUsd: 199, annualUsd: 1910, salesState: "coming_soon" },
];

/**
 * The offer catalog is smaller than the receipt catalog on purpose.
 * Existing provider product ids remain recognized after a plan stops taking
 * new purchases, while every sales surface derives from this filtered list.
 */
export const PURCHASABLE_HOMA_PLANS: readonly PlanDefinition[] = HOMA_PLANS.filter(
  (plan) => plan.salesState === "available",
);

export interface ProviderProduct {
  provider: BillingProvider;
  productId: string;
  tier: PlanTier;
  period: BillingPeriod;
}

/**
 * StoreKit products that must be created in App Store Connect before the
 * iOS paywall goes live. Monthly and annual products at the same tier sit
 * on the same App Store subscription level.
 */
export const APPLE_PROVIDER_PRODUCTS: readonly ProviderProduct[] = [
  { provider: "apple", productId: "com.thankshoma.homa.regular.monthly", tier: "regular", period: "monthly" },
  { provider: "apple", productId: "com.thankshoma.homa.regular.annual", tier: "regular", period: "annual" },
  { provider: "apple", productId: "com.thankshoma.homa.plus.monthly", tier: "plus", period: "monthly" },
  { provider: "apple", productId: "com.thankshoma.homa.plus.annual", tier: "plus", period: "annual" },
  { provider: "apple", productId: "com.thankshoma.homa.elite.monthly", tier: "elite", period: "monthly" },
  { provider: "apple", productId: "com.thankshoma.homa.elite.annual", tier: "elite", period: "annual" },
];

/**
 * Apple products Homa may use to begin a new StoreKit purchase today.
 *
 * Keep this narrower than APPLE_PROVIDER_PRODUCTS. The full provider catalog
 * must continue recognizing historical receipts, renewals, and upgrades after
 * an offer stops accepting new purchases.
 *
 * Both periods of every available tier (D3, 2026-08-31: annual ships now,
 * default-selected on the native paywall). The client still renders only
 * the products App Store Connect actually returns, so the annual card
 * stays dark until the founder creates the annual SKU there.
 */
export const APPLE_NEW_PURCHASE_PRODUCTS: readonly ProviderProduct[] =
  APPLE_PROVIDER_PRODUCTS.filter(
    (product) => planAvailableForPurchase(product.tier),
  );

export const APPLE_NEW_PURCHASE_PRODUCT_IDS = APPLE_NEW_PURCHASE_PRODUCTS.map(
  (product) => product.productId,
);

/** Google Play product ids are reserved now, before Android implementation. */
export const GOOGLE_PROVIDER_PRODUCTS: readonly ProviderProduct[] = [
  { provider: "google", productId: "com.thankshoma.homa.regular.monthly", tier: "regular", period: "monthly" },
  { provider: "google", productId: "com.thankshoma.homa.regular.annual", tier: "regular", period: "annual" },
  { provider: "google", productId: "com.thankshoma.homa.plus.monthly", tier: "plus", period: "monthly" },
  { provider: "google", productId: "com.thankshoma.homa.plus.annual", tier: "plus", period: "annual" },
  { provider: "google", productId: "com.thankshoma.homa.elite.monthly", tier: "elite", period: "monthly" },
  { provider: "google", productId: "com.thankshoma.homa.elite.annual", tier: "elite", period: "annual" },
];

export const APPLE_PRODUCT_IDS = APPLE_PROVIDER_PRODUCTS.map((product) => product.productId);

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && (PLAN_TIERS as readonly string[]).includes(value);
}

export function isBillingPeriod(value: unknown): value is BillingPeriod {
  return typeof value === "string" && (BILLING_PERIODS as readonly string[]).includes(value);
}

export function isBillingProvider(value: unknown): value is BillingProvider {
  return typeof value === "string" && (BILLING_PROVIDERS as readonly string[]).includes(value);
}

export function planDefinition(tier: PlanTier): PlanDefinition {
  return HOMA_PLANS.find((plan) => plan.tier === tier) ?? HOMA_PLANS[0];
}

export function planAvailableForPurchase(tier: PlanTier): boolean {
  return planDefinition(tier).salesState === "available";
}

export function providerProduct(
  provider: BillingProvider,
  productId: string | null | undefined,
): ProviderProduct | null {
  if (!productId) return null;
  const products =
    provider === "apple"
      ? APPLE_PROVIDER_PRODUCTS
      : provider === "google"
        ? GOOGLE_PROVIDER_PRODUCTS
        : [];
  return products.find((product) => product.productId === productId) ?? null;
}

export function appleProductAvailableForNewPurchase(
  productId: string | null | undefined,
): ProviderProduct | null {
  if (!productId) return null;
  return APPLE_NEW_PURCHASE_PRODUCTS.find(
    (product) => product.productId === productId,
  ) ?? null;
}

/** The honest weekly equivalent for US-only mobile marketing. */
export function weeklyEquivalentUsd(tier: PlanTier, period: BillingPeriod): number {
  const plan = planDefinition(tier);
  const amount = period === "annual" ? plan.annualUsd / 52 : plan.monthlyUsd / (52 / 12);
  return Math.round(amount * 100) / 100;
}
