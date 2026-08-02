import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plusCapabilityDecision } from "./plus-capability";

const FAMILY = {
  billingExempt: false,
  planTier: "regular" as const,
  providerStatuses: [] as const,
};

describe("plusCapabilityDecision", () => {
  it("admits exempt, Plus, and Elite families", () => {
    assert.equal(
      plusCapabilityDecision({
        family: { ...FAMILY, billingExempt: true },
        entitlement: null,
      }),
      true,
    );
    for (const tier of ["plus", "elite"] as const) {
      assert.equal(
        plusCapabilityDecision({
          family: FAMILY,
          entitlement: {
            active: true,
            hasBillingHistory: true,
            provider: "stripe",
            tier,
            period: "monthly",
            currentPeriodEnd: null,
          },
        }),
        true,
      );
    }
  });

  it("denies regular and lapsed Plus families", () => {
    assert.equal(
      plusCapabilityDecision({ family: FAMILY, entitlement: null }),
      false,
    );
    assert.equal(
      plusCapabilityDecision({
        family: FAMILY,
        entitlement: {
          active: false,
          hasBillingHistory: true,
          provider: null,
          tier: "regular",
          period: null,
          currentPeriodEnd: null,
        },
      }),
      false,
    );
    assert.equal(
      plusCapabilityDecision({
        family: {
          ...FAMILY,
          planTier: "plus",
          providerStatuses: ["canceled"],
        },
        entitlement: null,
      }),
      false,
    );
  });

  it("uses the legacy mirror only when no canonical ledger exists", () => {
    assert.equal(
      plusCapabilityDecision({
        family: { ...FAMILY, planTier: "plus" },
        entitlement: null,
      }),
      true,
    );
    assert.equal(
      plusCapabilityDecision({
        family: { ...FAMILY, planTier: "plus" },
        entitlement: {
          active: true,
          hasBillingHistory: true,
          provider: "stripe",
          tier: "regular",
          period: "annual",
          currentPeriodEnd: null,
        },
      }),
      false,
    );
  });
});

