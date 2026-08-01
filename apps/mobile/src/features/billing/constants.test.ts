import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { APPLE_NATIVE_PRODUCT_IDS, APPLE_NATIVE_PROVIDER_PRODUCTS } from "./constants";

describe("native Apple offer catalog", () => {
  it("offers one monthly product per Homa tier", () => {
    assert.deepEqual(
      APPLE_NATIVE_PROVIDER_PRODUCTS.map(({ tier, period }) => ({ tier, period })),
      [
        { tier: "regular", period: "monthly" },
        { tier: "plus", period: "monthly" },
        { tier: "elite", period: "monthly" },
      ],
    );
    assert.equal(APPLE_NATIVE_PRODUCT_IDS.length, 3);
  });

  it("does not merchandise annual products", () => {
    assert.equal(
      APPLE_NATIVE_PRODUCT_IDS.some((productId) => productId.endsWith(".annual")),
      false,
    );
  });
});
