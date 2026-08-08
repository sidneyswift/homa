import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPLE_PRODUCT_IDS,
  HOMA_PLANS,
  PURCHASABLE_HOMA_PLANS,
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
