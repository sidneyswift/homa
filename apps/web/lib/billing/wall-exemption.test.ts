import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { mobileOnboardingAccountBypass, wallExemption } from "./wall";

const originalFlag = process.env.HOMA_CHAT_ONBOARDING;

afterEach(() => {
  if (originalFlag === undefined) delete process.env.HOMA_CHAT_ONBOARDING;
  else process.env.HOMA_CHAT_ONBOARDING = originalFlag;
});

const walled = {
  billingExempt: false,
  trialStartedAt: null,
  profileCompletedAt: "2026-07-01T10:00:00.000Z",
  context: { styles: ["classical"] },
};

describe("wallExemption", () => {
  it("walls a completed, non-exempt, non-trialing family", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(wallExemption(walled), null);
  });

  it("exempts on billing_exempt first, whatever else is true", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(
      wallExemption({ ...walled, billingExempt: true, profileCompletedAt: null }),
      "billing_exempt",
    );
  });

  it("exempts a trialing family before the onboarding bypass is consulted", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(
      wallExemption({
        ...walled,
        trialStartedAt: "2026-07-19T10:00:00.000Z",
        profileCompletedAt: null,
      }),
      "trial_started",
    );
  });

  it("opens the door for a family still in chat onboarding", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(
      wallExemption({
        ...walled,
        context: { onboarding: { state: "active" } },
      }),
      "onboarding",
    );
  });

  it("walls again the moment onboarding is done", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(
      wallExemption({
        ...walled,
        context: { onboarding: { state: "done" } },
      }),
      null,
    );
  });

  it("changes nothing at all while the chat onboarding flag is off", () => {
    process.env.HOMA_CHAT_ONBOARDING = "";
    assert.equal(
      wallExemption({ ...walled, profileCompletedAt: null }),
      null,
    );
    assert.equal(
      wallExemption({ ...walled, context: { onboarding: { state: "active" } } }),
      null,
    );
  });
});

/** gh#305, phone app only: the account gate's one REST-side bypass. */
describe("mobileOnboardingAccountBypass", () => {
  const activeRow = {
    profileCompletedAt: null,
    context: { onboarding: { state: "active" } },
  };

  it("opens for the mobile channel while onboarding is active", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(mobileOnboardingAccountBypass("mobile", activeRow), true);
  });

  it("never opens for the web channel, whatever the family state", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(mobileOnboardingAccountBypass("web", activeRow), false);
    assert.equal(mobileOnboardingAccountBypass(null, activeRow), false);
  });

  it("closes again the moment onboarding is done", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(
      mobileOnboardingAccountBypass("mobile", {
        profileCompletedAt: null,
        context: { onboarding: { state: "done" } },
      }),
      false,
    );
    assert.equal(
      mobileOnboardingAccountBypass("mobile", {
        profileCompletedAt: "2026-07-01T10:00:00.000Z",
        context: {},
      }),
      false,
    );
  });

  it("fails closed on a missing family row", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(mobileOnboardingAccountBypass("mobile", null), false);
  });

  it("stays closed while the chat onboarding flag is off", () => {
    process.env.HOMA_CHAT_ONBOARDING = "";
    assert.equal(mobileOnboardingAccountBypass("mobile", activeRow), false);
  });
});
