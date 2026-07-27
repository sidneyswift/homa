import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { accountAccessDecision } from "./wall";

/**
 * The signup paywall's entitlement decision (founder directive
 * 2026-07-26). Unlike wallExemption there is deliberately NO onboarding
 * grant (the gate exists to meet the family before the product does),
 * and the subscription-status mirror is finally load-bearing: a lapsed
 * subscription ends access instead of riding the old permanent
 * trial_started_at unlock. The grandfather cutoff (HOMA_SIGNUP_PAYWALL_SINCE,
 * passed in as sinceMs) scopes the gate to families created after it.
 */

const walled = {
  billingExempt: false,
  trialStartedAt: null,
  subscriptionStatus: null,
  createdAtMs: Date.parse("2026-07-27T12:00:00Z"),
};

const NO_CUTOFF = null;
const CUTOFF = Date.parse("2026-07-27T00:00:00Z");

describe("accountAccessDecision", () => {
  it("walls a fresh family with no trial and no exemption", () => {
    assert.equal(accountAccessDecision(walled, NO_CUTOFF), null);
  });

  it("grants billing_exempt first, whatever else is true", () => {
    assert.equal(
      accountAccessDecision(
        { ...walled, billingExempt: true, subscriptionStatus: "canceled" },
        NO_CUTOFF,
      ),
      "billing_exempt",
    );
  });

  it("grandfathers a family created before the cutoff, even a lapsed one", () => {
    assert.equal(
      accountAccessDecision(
        {
          ...walled,
          createdAtMs: Date.parse("2026-07-20T09:00:00Z"),
          trialStartedAt: "2026-07-20T10:00:00.000Z",
          subscriptionStatus: "canceled",
        },
        CUTOFF,
      ),
      "grandfathered",
    );
  });

  it("gates a family created after the cutoff", () => {
    assert.equal(accountAccessDecision(walled, CUTOFF), null);
  });

  it("ignores the cutoff when created_at is unknown", () => {
    assert.equal(
      accountAccessDecision({ ...walled, createdAtMs: null }, CUTOFF),
      null,
    );
  });

  it("grants a started trial while the mirror is silent (webhook dark)", () => {
    assert.equal(
      accountAccessDecision(
        { ...walled, trialStartedAt: "2026-07-20T10:00:00.000Z" },
        NO_CUTOFF,
      ),
      "trial",
    );
  });

  it("grants trialing and active subscriptions", () => {
    for (const status of ["trialing", "active"]) {
      assert.equal(
        accountAccessDecision(
          {
            ...walled,
            trialStartedAt: "2026-07-20T10:00:00.000Z",
            subscriptionStatus: status,
          },
          NO_CUTOFF,
        ),
        "trial",
      );
    }
  });

  it("keeps past_due open while Stripe's smart retries run", () => {
    assert.equal(
      accountAccessDecision(
        {
          ...walled,
          trialStartedAt: "2026-07-20T10:00:00.000Z",
          subscriptionStatus: "past_due",
        },
        NO_CUTOFF,
      ),
      "trial",
    );
  });

  it("walls every lapsed status even with the old trial stamp", () => {
    for (const status of ["canceled", "unpaid", "incomplete_expired", "paused"]) {
      assert.equal(
        accountAccessDecision(
          {
            ...walled,
            trialStartedAt: "2026-07-20T10:00:00.000Z",
            subscriptionStatus: status,
          },
          NO_CUTOFF,
        ),
        null,
        `expected ${status} to wall`,
      );
    }
  });

  it("never grants on a subscription status alone, without the trial stamp", () => {
    assert.equal(
      accountAccessDecision({ ...walled, subscriptionStatus: "active" }, NO_CUTOFF),
      null,
    );
  });
});
