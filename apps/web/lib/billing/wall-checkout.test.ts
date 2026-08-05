import assert from "node:assert/strict";
import test from "node:test";

import { buildWallCheckout } from "./wall";

const PAYMENT_LINK_KEYS = [
  "NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL",
  "NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ANNUAL_URL",
  "NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_PLUS_MONTHLY_URL",
  "NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_PLUS_ANNUAL_URL",
  "NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ELITE_MONTHLY_URL",
  "NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ELITE_ANNUAL_URL",
] as const;

test("legacy Max links never enter a new web checkout", () => {
  const before = Object.fromEntries(PAYMENT_LINK_KEYS.map((key) => [key, process.env[key]]));
  try {
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL = "https://buy.stripe.com/test-regular-monthly";
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ANNUAL_URL = "https://buy.stripe.com/test-regular-annual";
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_PLUS_MONTHLY_URL = "https://buy.stripe.com/test-plus-monthly";
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_PLUS_ANNUAL_URL = "https://buy.stripe.com/test-plus-annual";
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ELITE_MONTHLY_URL = "https://buy.stripe.com/test-max-monthly";
    process.env.NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_ELITE_ANNUAL_URL = "https://buy.stripe.com/test-max-annual";

    const checkout = buildWallCheckout("family-test", "parent@example.test");

    assert.ok(checkout);
    assert.match(checkout.regular.monthlyUrl, /test-regular-monthly/u);
    assert.match(checkout.plus?.monthlyUrl ?? "", /test-plus-monthly/u);
    assert.equal(checkout.elite, null);
    assert.doesNotMatch(JSON.stringify(checkout), /test-max/u);
  } finally {
    for (const key of PAYMENT_LINK_KEYS) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
