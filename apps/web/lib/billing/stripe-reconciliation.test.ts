import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type Stripe from "stripe";

import {
  reconcileStaleStripeSubscriptions,
  selectCustomerSubscription,
  stripeSubscriptionObservation,
  type StripeReconciliationCandidate,
  type StripeReconciliationGateway,
} from "./stripe-reconciliation";

function subscription(
  id: string,
  status: Stripe.Subscription.Status,
  product = "prod_Uq02Zo8DUidRnH",
): Stripe.Subscription {
  return {
    id,
    status,
    customer: "cus_test",
    items: {
      data: [
        {
          current_period_end: 1_800_000_000,
          price: {
            id: "price_test",
            product,
            recurring: { interval: "month" },
          },
        },
      ],
    },
  } as Stripe.Subscription;
}

const candidates: StripeReconciliationCandidate[] = [
  { familyId: "family-active", subscriptionId: "sub_active", customerId: "cus_active" },
  { familyId: "family-lapsed", subscriptionId: "sub_lapsed", customerId: "cus_lapsed" },
  { familyId: "family-failed", subscriptionId: "sub_failed", customerId: "cus_failed" },
];

describe("Stripe subscription reconciliation", () => {
  it("normalizes the exact provider record without guessing an unknown tier", () => {
    const known = stripeSubscriptionObservation(subscription("sub_known", "active"));
    assert.deepEqual(known, {
      id: "sub_known",
      status: "active",
      priceId: "price_test",
      productId: "prod_Uq02Zo8DUidRnH",
      customerId: "cus_test",
      tier: "regular",
      period: "monthly",
      currentPeriodEndSec: 1_800_000_000,
    });
    assert.equal(
      stripeSubscriptionObservation(subscription("sub_unknown", "active", "prod_unknown")).tier,
      null,
    );
  });

  it("selects one current customer subscription and refuses ambiguity", () => {
    const active = subscription("sub_active", "active");
    const canceled = subscription("sub_canceled", "canceled");
    assert.equal(selectCustomerSubscription([canceled, active])?.id, "sub_active");
    assert.equal(selectCustomerSubscription([canceled])?.id, "sub_canceled");
    assert.equal(
      selectCustomerSubscription([active, subscription("sub_trial", "trialing")]),
      null,
    );
  });

  it("records verified active and lapsed states, and changes nothing on a failed read", async () => {
    const recorded: Array<{ familyId: string; status: string }> = [];
    const gateway: StripeReconciliationGateway = {
      retrieveSubscription: async (id) => {
        if (id === "sub_failed") throw new Error("provider unavailable");
        return id === "sub_lapsed"
          ? subscription(id, "canceled")
          : subscription(id, "active");
      },
      listCustomerSubscriptions: async () => [],
    };
    const result = await reconcileStaleStripeSubscriptions({
      database: {} as never,
      find: async () => candidates,
      gateway,
      record: async (familyId, observation) => {
        recorded.push({ familyId, status: observation.status });
      },
    });
    assert.deepEqual(result, {
      considered: 3,
      reconciled: 2,
      lapsed: 1,
      unresolved: 0,
      failed: 1,
    });
    assert.deepEqual(recorded, [
      { familyId: "family-active", status: "active" },
      { familyId: "family-lapsed", status: "canceled" },
    ]);
  });

  it("is wired into the hourly cron and its heartbeat", () => {
    const route = readFileSync(
      path.resolve(import.meta.dirname, "../../app/api/map/cron/route.ts"),
      "utf8",
    );
    assert.match(route, /reconcileStaleStripeSubscriptions\(\)/u);
    assert.match(route, /billingReconciliation/u);
  });
});
