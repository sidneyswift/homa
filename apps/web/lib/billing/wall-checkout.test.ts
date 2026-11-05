import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { verifyCheckoutIntent } from "./checkout-intent";
import { buildWallCheckout } from "./wall";

const FAMILY_ID = "00000000-0000-4000-8000-000000000421";
const CHECKOUT_SECRET = "wall-checkout-test-secret-at-least-32-bytes";

const PAYMENT_LINK_KEYS = [
  "NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL",
  "NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ANNUAL_URL",
  "NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_PLUS_MONTHLY_URL",
  "NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_PLUS_ANNUAL_URL",
  "NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ELITE_MONTHLY_URL",
  "NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ELITE_ANNUAL_URL",
] as const;

test("unavailable Plus and Max links never enter a new web checkout", () => {
  const before = Object.fromEntries(PAYMENT_LINK_KEYS.map((key) => [key, process.env[key]]));
  const previousSecret = process.env.STRIPE_TEST_SECRET_KEY;
  try {
    process.env.STRIPE_TEST_SECRET_KEY = CHECKOUT_SECRET;
    process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL = "https://buy.stripe.com/test-regular-monthly";
    process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ANNUAL_URL = "https://buy.stripe.com/test-regular-annual";
    process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_PLUS_MONTHLY_URL = "https://buy.stripe.com/test-plus-monthly";
    process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_PLUS_ANNUAL_URL = "https://buy.stripe.com/test-plus-annual";
    process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ELITE_MONTHLY_URL = "https://buy.stripe.com/test-max-monthly";
    process.env.NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_ELITE_ANNUAL_URL = "https://buy.stripe.com/test-max-annual";

    const checkout = buildWallCheckout(FAMILY_ID, "parent@example.test");

    assert.ok(checkout);
    const monthlyUrl = new URL(checkout.regular.monthlyUrl, "https://thankshoma.com");
    assert.equal(monthlyUrl.pathname, "/api/billing/checkout");
    assert.equal(monthlyUrl.searchParams.get("tier"), "regular");
    assert.equal(monthlyUrl.searchParams.get("period"), "monthly");
    const intent = monthlyUrl.searchParams.get("intent");
    assert.ok(intent);
    assert.ok(verifyCheckoutIntent(intent, {
      secret: CHECKOUT_SECRET,
      expected: {
        familyId: FAMILY_ID,
        tier: "regular",
        billingPeriod: "monthly",
      },
    }));
    assert.doesNotMatch(checkout.regular.monthlyUrl, /buy\.stripe\.com/u);
    assert.equal(checkout.plus, null);
    assert.equal(checkout.elite, null);
    assert.doesNotMatch(JSON.stringify(checkout), /test-plus|test-max/u);
  } finally {
    for (const key of PAYMENT_LINK_KEYS) {
      const value = before[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (previousSecret === undefined) delete process.env.STRIPE_TEST_SECRET_KEY;
    else process.env.STRIPE_TEST_SECRET_KEY = previousSecret;
  }
});

test("an unavailable Plus plan leaves no regular-family filing upsell", () => {
  // The Binder renders from binder-content.tsx since App 2 opened it
  // beside chat; page.tsx is now only its route wrapper.
  const binderPage = readFileSync(
    new URL("../../app/app/binder/binder-content.tsx", import.meta.url),
    "utf8",
  );
  const filingCard = readFileSync(
    new URL("../../app/app/binder/state-filing-card.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    binderPage,
    /filingKind && stateDetail && \(planTier === "plus" \|\| planTier === "elite"\)/u,
  );
  assert.doesNotMatch(filingCard, /See Homa Plus|Plus fills your filing/iu);
});
