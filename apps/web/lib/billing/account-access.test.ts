import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { accountAccessDecision } from "./wall";

/**
 * The signup paywall's entitlement decision (founder directive
 * 2026-07-26). Unlike wallExemption there is deliberately NO onboarding
 * grant (the gate exists to meet the family before the product does),
 * and the subscription-status mirror is finally load-bearing: a lapsed
 * subscription ends access instead of riding the old permanent
 * trial_started_at unlock.
 */

const walled = {
  billingExempt: false,
  trialStartedAt: null,
  subscriptionStatus: null,
};

describe("accountAccessDecision", () => {
  it("walls a fresh family with no trial and no exemption", () => {
    assert.equal(accountAccessDecision(walled), null);
  });

  it("grants billing_exempt first, whatever else is true", () => {
    assert.equal(
      accountAccessDecision({
        ...walled,
        billingExempt: true,
        subscriptionStatus: "canceled",
      }),
      "billing_exempt",
    );
  });

  it("grants a started trial while the mirror is silent (webhook dark)", () => {
    assert.equal(
      accountAccessDecision({
        ...walled,
        trialStartedAt: "2026-07-20T10:00:00.000Z",
      }),
      "trial",
    );
  });

  it("grants trialing and active subscriptions", () => {
    for (const status of ["trialing", "active"]) {
      assert.equal(
        accountAccessDecision({
          ...walled,
          trialStartedAt: "2026-07-20T10:00:00.000Z",
          subscriptionStatus: status,
        }),
        "trial",
      );
    }
  });

  it("keeps past_due open while Stripe's smart retries run", () => {
    assert.equal(
      accountAccessDecision({
        ...walled,
        trialStartedAt: "2026-07-20T10:00:00.000Z",
        subscriptionStatus: "past_due",
      }),
      "trial",
    );
  });

  it("walls every lapsed status even with the old trial stamp", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired", "paused"]) {
      assert.equal(
        accountAccessDecision({
          ...walled,
          trialStartedAt: "2026-07-20T10:00:00.000Z",
          subscriptionStatus: status,
        }),
        null,
        `expected ${status} to wall`,
      );
    }
  });

  it("never grants on a subscription status alone, without the trial stamp", () => {
    assert.equal(
      accountAccessDecision({ ...walled, subscriptionStatus: "active" }),
      null,
    );
  });
});
