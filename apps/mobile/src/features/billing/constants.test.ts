import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { APPLE_NATIVE_PRODUCT_IDS, APPLE_NATIVE_PROVIDER_PRODUCTS } from "./constants";

const billingGateSource = readFileSync(
  new URL("../../components/billing-gate.tsx", import.meta.url),
  "utf8",
);
const stateRecordsSource = readFileSync(
  new URL("../state-records/state-records-card.tsx", import.meta.url),
  "utf8",
);

describe("native Apple offer catalog", () => {
  it("offers monthly and annual for the one purchasable Homa tier", () => {
    // ios-headspace-pricing (2026-09-01): monthly $9.99 (7-day trial)
    // plus annual $99.99 (14-day trial), annual default on the paywall.
    assert.deepEqual(
      APPLE_NATIVE_PROVIDER_PRODUCTS.map(({ tier, period }) => ({ tier, period })),
      [
        { tier: "regular", period: "monthly" },
        { tier: "regular", period: "annual" },
      ],
    );
    assert.equal(APPLE_NATIVE_PRODUCT_IDS.length, 2);
    assert.equal(
      APPLE_NATIVE_PRODUCT_IDS.some(
        (productId) => productId.includes(".plus.") || productId.includes(".elite."),
      ),
      false,
    );
  });

  it("does not promise paused or unverified offers from the regular-only gate", () => {
    assert.doesNotMatch(billingGateSource, /every Homa surface|free trial|free 7 days|7 free days/iu);
    assert.doesNotMatch(billingGateSource, /Choose your Homa plan|Pick the Homa plan/iu);
    assert.match(billingGateSource, /weekly plans, practice pages, progress reports, and teaching-hour records/iu);
    assert.match(billingGateSource, /Subscribe for \$\{displayPrice\} a month/u);
    assert.match(billingGateSource, /Apple Account subscription settings/u);
  });

  it("does not route a family to a filing upgrade that cannot be bought", () => {
    assert.doesNotMatch(stateRecordsSource, /See filing upgrade/iu);
    assert.doesNotMatch(
      stateRecordsSource,
      /!summary\.filing\.entitled[\s\S]{0,300}router\.push\("\/settings"\)/u,
    );
  });
});
