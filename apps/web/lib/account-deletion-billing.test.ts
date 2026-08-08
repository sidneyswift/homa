import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";

import {
  createStripeAccountDeletionGateway,
  createStripeAccountDeletionReconciler,
  StripeAccountDeletionUncertainError,
  type StripeAccountDeletionGateway,
  type StripeAccountDeletionPage,
  type StripeDeletionCheckoutSession,
  type StripeDeletionSubscription,
} from "./account-deletion-billing";

function page<T extends { id: string }>(
  data: readonly T[],
  hasMore = false,
): StripeAccountDeletionPage<T> {
  return { data, hasMore };
}

function session(
  id: string,
  familyId: string | null,
  customerId: string | null = null,
  subscriptionId: string | null = null,
): StripeDeletionCheckoutSession {
  return { id, clientReferenceId: familyId, customerId, subscriptionId };
}

function subscription(
  id: string,
  status: string,
  customerId = "cus_default",
): StripeDeletionSubscription {
  return { id, status, customerId };
}

function unusedGateway(): StripeAccountDeletionGateway {
  return {
    listCheckoutSessions: async () => page([]),
    expireCheckoutSession: async (id) => ({ id, status: "expired" }),
    listSubscriptions: async () => page([]),
    retrieveSubscription: async (id) => subscription(id, "canceled"),
    cancelSubscription: async (id) => subscription(id, "canceled"),
  };
}

test("the production gateway asks Stripe for exhaustive provider-owned records", async () => {
  const requests: Array<{ operation: string; value: unknown }> = [];
  const stripe = {
    checkout: {
      sessions: {
        list: async (params: Record<string, unknown>) => {
          requests.push({ operation: "checkout.list", value: params });
          return {
            data: [{
              id: "cs_family",
              client_reference_id: "family-id",
              customer: { id: "cus_family" },
              subscription: "sub_family",
            }],
            has_more: false,
          };
        },
        expire: async (id: string) => {
          requests.push({ operation: "checkout.expire", value: id });
          return { id, status: "expired" };
        },
      },
    },
    subscriptions: {
      list: async (params: Record<string, unknown>) => {
        requests.push({ operation: "subscriptions.list", value: params });
        return {
          data: [{ id: "sub_family", customer: "cus_family", status: "active" }],
          has_more: false,
        };
      },
      retrieve: async (id: string) => {
        requests.push({ operation: "subscriptions.retrieve", value: id });
        return { id, customer: "cus_family", status: "active" };
      },
      cancel: async (id: string) => {
        requests.push({ operation: "subscriptions.cancel", value: id });
        return { id, customer: "cus_family", status: "canceled" };
      },
    },
  } as unknown as Stripe;
  const gateway = createStripeAccountDeletionGateway(stripe);

  assert.deepEqual(await gateway.listCheckoutSessions({
    status: "complete",
    createdGte: 123,
    startingAfter: "cs_before",
    limit: 100,
  }), page([session("cs_family", "family-id", "cus_family", "sub_family")]));
  assert.deepEqual(await gateway.expireCheckoutSession("cs_family"), {
    id: "cs_family",
    status: "expired",
  });
  assert.deepEqual(await gateway.listSubscriptions({
    customerId: "cus_family",
    startingAfter: "sub_before",
    limit: 100,
  }), page([subscription("sub_family", "active", "cus_family")]));
  assert.deepEqual(
    await gateway.retrieveSubscription("sub_family"),
    subscription("sub_family", "active", "cus_family"),
  );
  assert.deepEqual(
    await gateway.cancelSubscription("sub_family"),
    subscription("sub_family", "canceled", "cus_family"),
  );

  assert.deepEqual(requests, [
    {
      operation: "checkout.list",
      value: {
        status: "complete",
        limit: 100,
        created: { gte: 123 },
        starting_after: "cs_before",
      },
    },
    { operation: "checkout.expire", value: "cs_family" },
    {
      operation: "subscriptions.list",
      value: {
        customer: "cus_family",
        status: "all",
        limit: 100,
        starting_after: "sub_before",
      },
    },
    { operation: "subscriptions.retrieve", value: "sub_family" },
    { operation: "subscriptions.cancel", value: "sub_family" },
  ]);
});

test("reconciles every exact family Stripe path across every page", async () => {
  const familyId = "11111111-1111-4111-8111-111111111111";
  const calls: string[] = [];
  const canceled: string[] = [];
  const expired: string[] = [];
  const gateway = unusedGateway();

  gateway.listCheckoutSessions = async (request) => {
    calls.push(
      `sessions:${request.status}:${request.createdGte ?? "all"}:${request.startingAfter ?? "first"}`,
    );
    if (request.status === "open" && !request.startingAfter) {
      return page(
        [
          session("cs_open_family_1", familyId),
          session("cs_open_other", "22222222-2222-4222-8222-222222222222"),
        ],
        true,
      );
    }
    if (request.status === "open") {
      return page([session("cs_open_family_2", familyId)]);
    }
    if (!request.startingAfter) {
      return page(
        [
          session("cs_complete_family", familyId, "cus_checkout", "sub_checkout"),
          session("cs_complete_other", "22222222-2222-4222-8222-222222222222", "cus_other", "sub_other"),
        ],
        true,
      );
    }
    return page([
      session("cs_complete_family_2", familyId, "cus_second", "sub_incomplete_expired"),
    ]);
  };
  gateway.expireCheckoutSession = async (id) => {
    calls.push(`expire:${id}`);
    expired.push(id);
    return { id, status: "expired" };
  };
  gateway.listSubscriptions = async (request) => {
    calls.push(`subscriptions:${request.customerId}:${request.startingAfter ?? "first"}`);
    if (request.customerId === "cus_mirror") {
      if (!request.startingAfter) {
        return page(
          [
            subscription("sub_active", "active", "cus_mirror"),
            subscription("sub_canceled", "canceled", "cus_mirror"),
          ],
          true,
        );
      }
      return page([subscription("sub_paused", "paused", "cus_mirror")]);
    }
    if (request.customerId === "cus_checkout") {
      return page([subscription("sub_checkout", "trialing", "cus_checkout")]);
    }
    if (request.customerId === "cus_second") {
      return page([
        subscription("sub_incomplete_expired", "incomplete_expired", "cus_second"),
      ]);
    }
    if (request.customerId === "cus_from_direct") {
      return page([subscription("sub_unpaid", "unpaid", "cus_from_direct")]);
    }
    assert.fail(`unexpected customer ${request.customerId}`);
  };
  gateway.retrieveSubscription = async (id) => {
    calls.push(`retrieve:${id}`);
    assert.equal(id, "sub_direct");
    return subscription(id, "past_due", "cus_from_direct");
  };
  gateway.cancelSubscription = async (id) => {
    calls.push(`cancel:${id}`);
    canceled.push(id);
    const customerId = id === "sub_active" || id === "sub_paused"
      ? "cus_mirror"
      : id === "sub_checkout"
        ? "cus_checkout"
        : "cus_from_direct";
    return subscription(id, "canceled", customerId);
  };

  const reconcile = createStripeAccountDeletionReconciler(gateway);
  const result = await reconcile({
    familyId,
    familyCreatedAt: new Date("2026-08-01T12:34:56.789Z"),
    knownCustomerIds: ["cus_mirror", "cus_mirror"],
    knownSubscriptionIds: ["sub_direct", "sub_active"],
  });

  assert.deepEqual(expired, ["cs_open_family_1", "cs_open_family_2"]);
  assert.deepEqual(new Set(canceled), new Set([
    "sub_active",
    "sub_paused",
    "sub_checkout",
    "sub_direct",
    "sub_unpaid",
  ]));
  assert.equal(canceled.length, 5);
  assert.deepEqual(result, {
    expiredCheckoutSessionCount: 2,
    inspectedCustomerCount: 4,
    inspectedSubscriptionCount: 7,
    canceledSubscriptionCount: 5,
    alreadyTerminalSubscriptionCount: 2,
  });
  assert.ok(
    calls.indexOf("sessions:open:all:first") < calls.indexOf("expire:cs_open_family_1"),
    "open-session pagination finishes before mutation starts",
  );
  assert.ok(
    calls.includes("sessions:complete:1785587696:first"),
    "completed Checkout discovery starts at the family's creation second",
  );
  assert.ok(!calls.some((call) => call.includes("cus_other") || call.includes("sub_other")));
  assert.equal(calls.filter((call) => call === "retrieve:sub_direct").length, 1);
  assert.ok(!calls.includes("retrieve:sub_active"));
});

test("treats only canceled and incomplete_expired subscriptions as terminal", async () => {
  const statuses = [
    "active",
    "trialing",
    "past_due",
    "unpaid",
    "paused",
    "incomplete",
    "canceled",
    "incomplete_expired",
  ];
  const canceled: string[] = [];
  const gateway = unusedGateway();
  gateway.listSubscriptions = async ({ customerId }) => page(
    statuses.map((status) => subscription(`sub_${status}`, status, customerId)),
  );
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_family");
  };

  const result = await createStripeAccountDeletionReconciler(gateway)({
    familyId: "11111111-1111-4111-8111-111111111111",
    familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
    knownCustomerIds: ["cus_family"],
    knownSubscriptionIds: [],
  });

  assert.deepEqual(canceled, statuses
    .filter((status) => status !== "canceled" && status !== "incomplete_expired")
    .map((status) => `sub_${status}`));
  assert.equal(result.alreadyTerminalSubscriptionCount, 2);
});

test("fails closed with a log-safe error when Stripe is uncertain", async () => {
  const gateway = unusedGateway();
  gateway.listCheckoutSessions = async () => {
    throw new Error("provider leaked sk_live_do_not_repeat");
  };

  const reconcile = createStripeAccountDeletionReconciler(gateway);
  await assert.rejects(
    reconcile({
      familyId: "11111111-1111-4111-8111-111111111111",
      familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
      knownCustomerIds: [],
      knownSubscriptionIds: [],
    }),
    (error: unknown) => {
      assert.ok(error instanceof StripeAccountDeletionUncertainError);
      assert.equal(error.reason, "provider_request_failed");
      assert.doesNotMatch(error.message, /sk_live/u);
      assert.match(error.message, /could not confirm that every future Stripe charge is stopped/u);
      return true;
    },
  );
});

test("fails closed when provider pagination stalls", async () => {
  const gateway = unusedGateway();
  gateway.listCheckoutSessions = async () => page([], true);

  await assert.rejects(
    createStripeAccountDeletionReconciler(gateway)({
      familyId: "11111111-1111-4111-8111-111111111111",
      familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
      knownCustomerIds: [],
      knownSubscriptionIds: [],
    }),
    (error: unknown) => {
      assert.ok(error instanceof StripeAccountDeletionUncertainError);
      assert.equal(error.reason, "pagination_stalled");
      return true;
    },
  );
});

test("fails closed when Stripe does not confirm an expiration or cancellation", async (t) => {
  await t.test("Checkout expiration", async () => {
    const gateway = unusedGateway();
    gateway.listCheckoutSessions = async ({ status }) => status === "open"
      ? page([session("cs_open", "11111111-1111-4111-8111-111111111111")])
      : page([]);
    gateway.expireCheckoutSession = async (id) => ({ id, status: "complete" });

    await assert.rejects(
      createStripeAccountDeletionReconciler(gateway)({
        familyId: "11111111-1111-4111-8111-111111111111",
        familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
        knownCustomerIds: [],
        knownSubscriptionIds: [],
      }),
      (error: unknown) => error instanceof StripeAccountDeletionUncertainError
        && error.reason === "unexpected_provider_state",
    );
  });

  await t.test("subscription cancellation", async () => {
    const gateway = unusedGateway();
    gateway.retrieveSubscription = async (id) => subscription(id, "active", "cus_family");
    gateway.listSubscriptions = async () => page([]);
    gateway.cancelSubscription = async (id) => subscription(id, "active", "cus_family");

    await assert.rejects(
      createStripeAccountDeletionReconciler(gateway)({
        familyId: "11111111-1111-4111-8111-111111111111",
        familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
        knownCustomerIds: [],
        knownSubscriptionIds: ["sub_active"],
      }),
      (error: unknown) => error instanceof StripeAccountDeletionUncertainError
        && error.reason === "unexpected_provider_state",
    );
  });
});
