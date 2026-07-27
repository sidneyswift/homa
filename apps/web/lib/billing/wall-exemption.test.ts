import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { wallExemption } from "./wall";

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
