import assert from "node:assert/strict";
import test from "node:test";

import {
  configuredServerPaymentLinkUrls,
  configuredStripeSecretKey,
} from "./stripe-checkout-config";

const CONFIG_KEYS = [
  "VERCEL_ENV",
  "STRIPE_LIVE_SECRET_KEY",
  "STRIPE_TEST_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL",
  "NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL",
] as const;

function withStripeConfig(
  values: Partial<Record<(typeof CONFIG_KEYS)[number], string>>,
  run: () => void,
): void {
  const previous = Object.fromEntries(CONFIG_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of CONFIG_KEYS) delete process.env[key];
    Object.assign(process.env, values);
    run();
  } finally {
    for (const key of CONFIG_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("production checkout uses only live Stripe configuration", () => {
  withStripeConfig({
    VERCEL_ENV: "production",
    STRIPE_LIVE_SECRET_KEY: "live-secret-fixture",
    STRIPE_TEST_SECRET_KEY: "test-secret-fixture",
    NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL:
      "https://buy.stripe.com/live-monthly",
    NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL:
      "https://buy.stripe.com/test-monthly",
  }, () => {
    assert.equal(configuredStripeSecretKey(), "live-secret-fixture");
    assert.equal(
      configuredServerPaymentLinkUrls().regular?.monthly,
      "https://buy.stripe.com/live-monthly",
    );
  });
});

test("local and preview checkout use only test Stripe configuration", () => {
  for (const vercelEnv of [undefined, "preview"] as const) {
    withStripeConfig({
      ...(vercelEnv ? { VERCEL_ENV: vercelEnv } : {}),
      STRIPE_LIVE_SECRET_KEY: "live-secret-fixture",
      STRIPE_TEST_SECRET_KEY: "test-secret-fixture",
      NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL:
        "https://buy.stripe.com/live-monthly",
      NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL:
        "https://buy.stripe.com/test-monthly",
    }, () => {
      assert.equal(configuredStripeSecretKey(), "test-secret-fixture");
      assert.equal(
        configuredServerPaymentLinkUrls().regular?.monthly,
        "https://buy.stripe.com/test-monthly",
      );
    });
  }
});

test("non-production checkout never falls back to live credentials", () => {
  withStripeConfig({
    VERCEL_ENV: "development",
    STRIPE_LIVE_SECRET_KEY: "live-secret-fixture",
    NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL:
      "https://buy.stripe.com/live-monthly",
  }, () => {
    assert.equal(configuredStripeSecretKey(), null);
    assert.equal(configuredServerPaymentLinkUrls().regular, undefined);
  });
});
