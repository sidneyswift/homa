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
  stripeSubscriptionStatus: null,
  appleSubscriptionStatus: null,
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
        { ...walled, billingExempt: true, stripeSubscriptionStatus: "canceled" },
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
          stripeSubscriptionStatus: "canceled",
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
            stripeSubscriptionStatus: status,
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
          stripeSubscriptionStatus: "past_due",
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
            stripeSubscriptionStatus: status,
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
      accountAccessDecision({ ...walled, stripeSubscriptionStatus: "active" }, NO_CUTOFF),
      null,
    );
  });
});

/**
 * Two providers (ios-iap-priority, journeys/10-reconciliation.md §5): a
 * family is open if EITHER provider currently reads active, or if
 * NEITHER has ever recorded anything (the original single-provider
 * "webhook dark reads as fine" tolerance, unchanged for every family that
 * has never touched Apple billing, which today is all of them). Walled
 * only when at least one provider has recorded something and none of the
 * providers that have ever recorded anything currently reads active.
 */
describe("accountAccessDecision, two providers", () => {
  const trialing = {
    ...walled,
    trialStartedAt: "2026-07-20T10:00:00.000Z",
  };

  it("grants when neither provider has ever recorded anything (unchanged Stripe-only behavior)", () => {
    assert.equal(accountAccessDecision(trialing, NO_CUTOFF), "trial");
  });

  it("grants when Stripe is active and Apple has never been touched", () => {
    assert.equal(
      accountAccessDecision(
        { ...trialing, stripeSubscriptionStatus: "active" },
        NO_CUTOFF,
      ),
      "trial",
    );
  });

  it("grants when Apple is active and Stripe has never been touched", () => {
    assert.equal(
      accountAccessDecision(
        { ...trialing, appleSubscriptionStatus: "active" },
        NO_CUTOFF,
      ),
      "trial",
    );
  });

  it("walls when Stripe is lapsed and Apple has never been touched (matches single-provider behavior exactly)", () => {
    assert.equal(
      accountAccessDecision(
        { ...trialing, stripeSubscriptionStatus: "canceled" },
        NO_CUTOFF,
      ),
      null,
    );
  });

  it("walls when Apple is lapsed and Stripe has never been touched", () => {
    assert.equal(
      accountAccessDecision(
        { ...trialing, appleSubscriptionStatus: "canceled" },
        NO_CUTOFF,
      ),
      null,
    );
  });

  it("grants when Stripe lapsed but Apple re-subscribed (the recoup case: a re-subscribing family must never stay walled behind the other provider's stale mirror)", () => {
    assert.equal(
      accountAccessDecision(
        {
          ...trialing,
          stripeSubscriptionStatus: "canceled",
          appleSubscriptionStatus: "active",
        },
        NO_CUTOFF,
      ),
      "trial",
    );
  });

  it("grants when Apple lapsed but Stripe re-subscribed (symmetric case)", () => {
    assert.equal(
      accountAccessDecision(
        {
          ...trialing,
          stripeSubscriptionStatus: "active",
          appleSubscriptionStatus: "canceled",
        },
        NO_CUTOFF,
      ),
      "trial",
    );
  });

  it("walls when both providers are lapsed", () => {
    assert.equal(
      accountAccessDecision(
        {
          ...trialing,
          stripeSubscriptionStatus: "canceled",
          appleSubscriptionStatus: "canceled",
        },
        NO_CUTOFF,
      ),
      null,
    );
  });

  it("keeps billing_exempt outranking both providers", () => {
    assert.equal(
      accountAccessDecision(
        {
          ...trialing,
          billingExempt: true,
          stripeSubscriptionStatus: "canceled",
          appleSubscriptionStatus: "canceled",
        },
        NO_CUTOFF,
      ),
      "billing_exempt",
    );
  });
});
