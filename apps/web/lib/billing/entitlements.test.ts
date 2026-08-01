import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  entitlementFromSubscriptions,
  type BillingSubscriptionRecord,
} from "./entitlements";

function subscription(
  overrides: Partial<BillingSubscriptionRecord> = {},
): BillingSubscriptionRecord {
  return {
    provider: "stripe",
    providerSubscriptionId: "sub_123",
    providerCustomerId: "cus_123",
    providerProductId: "prod_123",
    tier: "regular",
    period: "monthly",
    status: "active",
    currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    observedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("entitlementFromSubscriptions", () => {
  it("keeps an Apple-paid family open on every Homa surface", () => {
    assert.deepEqual(entitlementFromSubscriptions([subscription({ provider: "apple" })]), {
      active: true,
      hasBillingHistory: true,
      provider: "apple",
      tier: "regular",
      period: "monthly",
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    });
  });

  it("does not wall a family when a stale provider canceled but another is active", () => {
    const result = entitlementFromSubscriptions([
      subscription({ provider: "stripe", status: "canceled" }),
      subscription({
        provider: "apple",
        providerSubscriptionId: "apple_123",
        tier: "plus",
        period: "annual",
      }),
    ]);

    assert.equal(result?.active, true);
    assert.equal(result?.provider, "apple");
    assert.equal(result?.tier, "plus");
  });

  it("keeps the highest verified tier during an accidental overlap", () => {
    const result = entitlementFromSubscriptions([
      subscription({ tier: "regular" }),
      subscription({
        provider: "apple",
        providerSubscriptionId: "apple_123",
        tier: "elite",
      }),
    ]);

    assert.equal(result?.tier, "elite");
  });

  it("recognizes a fully lapsed billing history", () => {
    assert.deepEqual(entitlementFromSubscriptions([subscription({ status: "canceled" })]), {
      active: false,
      hasBillingHistory: true,
      provider: null,
      tier: "regular",
      period: null,
      currentPeriodEnd: null,
    });
  });
});
