import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPLE_NEW_PURCHASE_PRODUCT_IDS,
  APPLE_NEW_PURCHASE_PRODUCTS,
  APPLE_PRODUCT_IDS,
  HOMA_PLANS,
  PURCHASABLE_HOMA_PLANS,
  appleProductAvailableForNewPurchase,
  planAvailableForPurchase,
  providerProduct,
  weeklyEquivalentUsd,
} from "./billing-catalog";

describe("Homa billing catalog", () => {
  it("keeps each tier on monthly and annual terms", () => {
    assert.equal(APPLE_PRODUCT_IDS.length, HOMA_PLANS.length * 2);
    for (const plan of HOMA_PLANS) {
      assert.ok(providerProduct("apple", `com.thankshoma.homa.${plan.tier}.monthly`));
      assert.ok(providerProduct("apple", `com.thankshoma.homa.${plan.tier}.annual`));
    }
  });

  it("separates new offers from permanent receipt recognition", () => {
    assert.deepEqual(PURCHASABLE_HOMA_PLANS.map(({ tier }) => tier), ["regular"]);
    assert.equal(planAvailableForPurchase("regular"), true);
    assert.equal(planAvailableForPurchase("plus"), false);
    assert.equal(planAvailableForPurchase("elite"), false);
    assert.ok(providerProduct("apple", "com.thankshoma.homa.plus.monthly"));
    assert.ok(providerProduct("apple", "com.thankshoma.homa.elite.monthly"));
  });

  it("allows regular monthly and annual Apple products to begin new purchases", () => {
    // ios-headspace-pricing (2026-09-01): the founder reopened annual
    // ($99.99, 14-day trial) alongside monthly ($9.99, 7-day trial),
    // superseding ios-monthly-only-launch and ios-annual-overruled.
    // Plus/Max stay receipt-only; their ASC products were deleted.
    assert.deepEqual(
      APPLE_NEW_PURCHASE_PRODUCTS.map(({ tier, period }) => ({ tier, period })),
      [
        { tier: "regular", period: "monthly" },
        { tier: "regular", period: "annual" },
      ],
    );
    assert.deepEqual(APPLE_NEW_PURCHASE_PRODUCT_IDS, [
      "com.thankshoma.homa.regular.monthly",
      "com.thankshoma.homa.regular.annual",
    ]);
    assert.equal(
      appleProductAvailableForNewPurchase("com.thankshoma.homa.regular.monthly")?.tier,
      "regular",
    );
    assert.equal(
      appleProductAvailableForNewPurchase("com.thankshoma.homa.regular.annual")?.period,
      "annual",
    );
    assert.equal(
      appleProductAvailableForNewPurchase("com.thankshoma.homa.plus.monthly"),
      null,
    );
    assert.equal(
      appleProductAvailableForNewPurchase("com.thankshoma.homa.elite.annual"),
      null,
    );
  });

  it("never mistakes an unknown provider product for a plan", () => {
    assert.equal(providerProduct("apple", "com.thankshoma.homa.regular.weekly"), null);
    assert.equal(providerProduct("apple", "not-a-homa-product"), null);
    assert.equal(providerProduct("stripe", "com.thankshoma.homa.regular.monthly"), null);
  });

  it("uses weekly math only as a truthful display equivalent", () => {
    assert.equal(weeklyEquivalentUsd("regular", "monthly"), 4.38);
    assert.equal(weeklyEquivalentUsd("regular", "annual"), 3.5);
  });
});
