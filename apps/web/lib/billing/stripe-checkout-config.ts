import { planAvailableForPurchase } from "@homa/core";

import type { ServerPaymentLinkUrls } from "./server-checkout";

function isLiveStripeCheckout(): boolean {
  return process.env.VERCEL_ENV === "production";
}

export function configuredStripeSecretKey(): string | null {
  const value = isLiveStripeCheckout()
    ? process.env.STRIPE_LIVE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY;
  return value?.trim() || null;
}

/**
 * Public links remain configuration inputs only. They must be inactive in
 * Stripe; the server uses them to recover exact Price ids and returns only
 * Homa-owned, short-lived checkout routes to clients.
 */
export function configuredServerPaymentLinkUrls(): ServerPaymentLinkUrls {
  const live = isLiveStripeCheckout();
  let regular: ServerPaymentLinkUrls["regular"];
  let plus: ServerPaymentLinkUrls["plus"];
  let elite: ServerPaymentLinkUrls["elite"];
  if (planAvailableForPurchase("regular")) {
    const monthly = live
      ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL
      : process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL;
    const annual = live
      ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ANNUAL_URL
      : process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ANNUAL_URL;
    if (monthly) {
      regular = {
        monthly,
        ...(annual ? { annual } : {}),
      };
    }
  }
  if (planAvailableForPurchase("plus")) {
    const monthly = live
      ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_PLUS_MONTHLY_URL
      : process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_PLUS_MONTHLY_URL;
    const annual = live
      ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_PLUS_ANNUAL_URL
      : process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_PLUS_ANNUAL_URL;
    if (monthly) {
      plus = {
        monthly,
        ...(annual ? { annual } : {}),
      };
    }
  }
  if (planAvailableForPurchase("elite")) {
    const monthly = live
      ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ELITE_MONTHLY_URL
      : process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ELITE_MONTHLY_URL;
    const annual = live
      ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ELITE_ANNUAL_URL
      : process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ELITE_ANNUAL_URL;
    if (monthly) {
      elite = {
        monthly,
        ...(annual ? { annual } : {}),
      };
    }
  }
  return {
    ...(regular ? { regular } : {}),
    ...(plus ? { plus } : {}),
    ...(elite ? { elite } : {}),
  };
}

export function configuredCheckoutOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://thankshoma.com";
}
