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

  it("allows both periods of available tiers to begin new purchases", () => {
    // D3 (2026-08-31): the annual plan ships at the ruled $119/year and
    // may begin new purchases; coming_soon tiers still may not.
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
  });

  it("never mistakes an unknown provider product for a plan", () => {
    assert.equal(providerProduct("apple", "com.thankshoma.homa.regular.weekly"), null);
    assert.equal(providerProduct("apple", "not-a-homa-product"), null);
    assert.equal(providerProduct("stripe", "com.thankshoma.homa.regular.monthly"), null);
  });

  it("uses weekly math only as a truthful display equivalent", () => {
    assert.equal(weeklyEquivalentUsd("regular", "monthly"), 4.38);
    // $119/year (D3): 119 / 52, rounded to cents.
    assert.equal(weeklyEquivalentUsd("regular", "annual"), 2.29);
  });
});
