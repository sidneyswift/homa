import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gateOpenForReason, gateReason } from "./gate-reason";

describe("gateReason", () => {
  it("names real access entitled, whatever the onboarding state", () => {
    assert.equal(
      gateReason({ checkoutRequired: false, onboardingExempt: false }),
      "entitled",
    );
    // Entitlement outranks the grace window in the telling: it is the
    // stronger, more durable fact, and the exemption only exists for
    // families a checkout would otherwise stop.
    assert.equal(
      gateReason({ checkoutRequired: false, onboardingExempt: true }),
      "entitled",
    );
  });

  it("names the mobile free window onboarding_grace", () => {
    assert.equal(
      gateReason({ checkoutRequired: true, onboardingExempt: true }),
      "onboarding_grace",
    );
  });

  it("names a required checkout with no excuse walled", () => {
    assert.equal(
      gateReason({ checkoutRequired: true, onboardingExempt: false }),
      "walled",
    );
  });
});

describe("gateOpenForReason", () => {
  it("derives open so the boolean can never disagree with the name", () => {
    assert.equal(gateOpenForReason("entitled"), true);
    assert.equal(gateOpenForReason("onboarding_grace"), true);
    assert.equal(gateOpenForReason("walled"), false);
  });
});
