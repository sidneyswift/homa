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

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";

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
  metadataFamilyId: string | null = FAMILY_ID,
): StripeDeletionSubscription {
  return { id, status, customerId, metadataFamilyId };
}

function unusedGateway(): StripeAccountDeletionGateway {
  return {
    listCheckoutSessions: async () => page([]),
    expireCheckoutSession: async (id) => ({ id, status: "expired" }),
    listAllSubscriptions: async () => page([]),
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
          data: [{
            id: "sub_family",
            customer: "cus_family",
            status: "active",
            metadata: { family_id: "family-id" },
          }],
          has_more: false,
        };
      },
      retrieve: async (id: string) => {
        requests.push({ operation: "subscriptions.retrieve", value: id });
        return { id, customer: "cus_family", status: "active", metadata: {} };
      },
      cancel: async (id: string) => {
        requests.push({ operation: "subscriptions.cancel", value: id });
        return {
          id,
          customer: "cus_family",
          status: "canceled",
          metadata: { family_id: "family-id" },
        };
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
  assert.deepEqual(await gateway.listAllSubscriptions({
    startingAfter: "sub_global_before",
    limit: 100,
  }), page([subscription("sub_family", "active", "cus_family", "family-id")]));
  assert.deepEqual(await gateway.listSubscriptions({
    customerId: "cus_family",
    startingAfter: "sub_before",
    limit: 100,
  }), page([subscription("sub_family", "active", "cus_family", "family-id")]));
  assert.deepEqual(
    await gateway.retrieveSubscription("sub_family"),
    subscription("sub_family", "active", "cus_family", null),
  );
  assert.deepEqual(
    await gateway.cancelSubscription("sub_family"),
    subscription("sub_family", "canceled", "cus_family", "family-id"),
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
        status: "all",
        limit: 100,
        starting_after: "sub_global_before",
      },
    },
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
  const familyId = FAMILY_ID;
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
    switch (id) {
      case "sub_direct":
        return subscription(id, "past_due", "cus_from_direct", null);
      case "sub_active":
        return subscription(id, "active", "cus_mirror");
      case "sub_checkout":
        return subscription(id, "trialing", "cus_checkout");
      case "sub_incomplete_expired":
        return subscription(id, "incomplete_expired", "cus_second");
      default:
        return assert.fail(`unexpected subscription ${id}`);
    }
  };
  gateway.cancelSubscription = async (id) => {
    calls.push(`cancel:${id}`);
    canceled.push(id);
    const customerId = id === "sub_active" || id === "sub_paused"
      ? "cus_mirror"
      : id === "sub_checkout"
        ? "cus_checkout"
        : "cus_from_direct";
    return subscription(
      id,
      "canceled",
      customerId,
      id === "sub_direct" ? null : familyId,
    );
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
  assert.equal(calls.filter((call) => call === "retrieve:sub_active").length, 1);
  assert.equal(calls.filter((call) => call === "retrieve:sub_checkout").length, 1);
  assert.equal(
    calls.filter((call) => call === "retrieve:sub_incomplete_expired").length,
    1,
  );
});

test("globally paginates exact family metadata on an unknown Stripe customer", async () => {
  const globalCursors: Array<string | undefined> = [];
  const canceled: string[] = [];
  const gateway = unusedGateway();
  gateway.listAllSubscriptions = async (request) => {
    globalCursors.push(request.startingAfter);
    if (request.startingAfter === undefined) {
      return page([
        subscription(
          "sub_other_family",
          "active",
          "cus_other",
          "22222222-2222-4222-8222-222222222222",
        ),
      ], true);
    }
    assert.equal(request.startingAfter, "sub_other_family");
    return page([
      subscription("sub_dashboard", "active", "cus_dashboard", FAMILY_ID),
    ]);
  };
  gateway.listSubscriptions = async ({ customerId }) => {
    assert.equal(customerId, "cus_dashboard");
    return page([
      subscription("sub_dashboard", "active", customerId, FAMILY_ID),
    ]);
  };
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_dashboard", FAMILY_ID);
  };

  const result = await createStripeAccountDeletionReconciler(gateway)({
    familyId: FAMILY_ID,
    familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
    knownCustomerIds: [],
    knownSubscriptionIds: [],
  });

  assert.deepEqual(globalCursors, [undefined, "sub_other_family"]);
  assert.deepEqual(canceled, ["sub_dashboard"]);
  assert.deepEqual(result, {
    expiredCheckoutSessionCount: 0,
    inspectedCustomerCount: 1,
    inspectedSubscriptionCount: 1,
    canceledSubscriptionCount: 1,
    alreadyTerminalSubscriptionCount: 0,
  });
});

test("fails closed when global subscription pagination stalls", async () => {
  const gateway = unusedGateway();
  gateway.listAllSubscriptions = async () => page([], true);

  await assert.rejects(
    createStripeAccountDeletionReconciler(gateway)({
      familyId: FAMILY_ID,
      familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
      knownCustomerIds: [],
      knownSubscriptionIds: [],
    }),
    (error: unknown) => error instanceof StripeAccountDeletionUncertainError
      && error.reason === "pagination_stalled",
  );
});

test("fails closed when only legacy Checkout points to a metadata-free subscription", async () => {
  const canceled: string[] = [];
  const retrieved: string[] = [];
  const gateway = unusedGateway();
  gateway.listCheckoutSessions = async ({ status }) => status === "complete"
    ? page([session("cs_legacy", FAMILY_ID, "cus_legacy", "sub_legacy_checkout")])
    : page([]);
  gateway.listSubscriptions = async ({ customerId }) => page([
    subscription("sub_legacy_checkout", "active", customerId, null),
  ]);
  gateway.retrieveSubscription = async (id) => {
    retrieved.push(id);
    return subscription(id, "active", "cus_legacy", null);
  };
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_legacy", null);
  };

  await assert.rejects(
    createStripeAccountDeletionReconciler(gateway)({
      familyId: FAMILY_ID,
      familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
      knownCustomerIds: [],
      knownSubscriptionIds: [],
    }),
    (error: unknown) => error instanceof StripeAccountDeletionUncertainError
      && error.reason === "unexpected_provider_state",
  );

  assert.deepEqual(retrieved, ["sub_legacy_checkout"]);
  assert.deepEqual(canceled, []);
});

test("reconciles metadata-free Checkout only with an exact local association", async () => {
  const canceled: string[] = [];
  const retrieved: string[] = [];
  const gateway = unusedGateway();
  gateway.listCheckoutSessions = async ({ status }) => status === "complete"
    ? page([session("cs_legacy", FAMILY_ID, "cus_legacy", "sub_legacy_checkout")])
    : page([]);
  gateway.listSubscriptions = async ({ customerId }) => page([
    subscription("sub_legacy_checkout", "active", customerId, null),
  ]);
  gateway.retrieveSubscription = async (id) => {
    retrieved.push(id);
    return subscription(id, "active", "cus_legacy", null);
  };
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_legacy", null);
  };

  const result = await createStripeAccountDeletionReconciler(gateway)({
    familyId: FAMILY_ID,
    familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
    knownCustomerIds: [],
    knownSubscriptionIds: ["sub_legacy_checkout"],
  });

  assert.deepEqual(retrieved, ["sub_legacy_checkout"]);
  assert.deepEqual(canceled, ["sub_legacy_checkout"]);
  assert.deepEqual(result, {
    expiredCheckoutSessionCount: 0,
    inspectedCustomerCount: 1,
    inspectedSubscriptionCount: 1,
    canceledSubscriptionCount: 1,
    alreadyTerminalSubscriptionCount: 0,
  });
});

test("fails closed when exact Checkout subscription metadata conflicts", async () => {
  const canceled: string[] = [];
  const gateway = unusedGateway();
  gateway.listCheckoutSessions = async ({ status }) => status === "complete"
    ? page([session("cs_conflict", FAMILY_ID, "cus_shared", "sub_checkout_conflict")])
    : page([]);
  gateway.listSubscriptions = async () => page([]);
  gateway.retrieveSubscription = async (id) => subscription(
    id,
    "active",
    "cus_shared",
    "22222222-2222-4222-8222-222222222222",
  );
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_shared");
  };

  await assert.rejects(
    createStripeAccountDeletionReconciler(gateway)({
      familyId: FAMILY_ID,
      familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
      knownCustomerIds: [],
      knownSubscriptionIds: [],
    }),
    (error: unknown) => error instanceof StripeAccountDeletionUncertainError
      && error.reason === "unexpected_provider_state",
  );
  assert.deepEqual(canceled, []);
});

test("fails closed on an unowned active subscription under an exact family customer", async () => {
  const canceled: string[] = [];
  const gateway = unusedGateway();
  gateway.listSubscriptions = async ({ customerId }) => page([
    subscription("sub_unowned_active", "active", customerId, null),
  ]);
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_family", null);
  };

  await assert.rejects(
    createStripeAccountDeletionReconciler(gateway)({
      familyId: FAMILY_ID,
      familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
      knownCustomerIds: ["cus_family"],
      knownSubscriptionIds: [],
    }),
    (error: unknown) => error instanceof StripeAccountDeletionUncertainError
      && error.reason === "unexpected_provider_state",
  );
  assert.deepEqual(canceled, []);
});

test("does not treat legacy Checkout customer discovery as ownership proof", async () => {
  const canceled: string[] = [];
  const gateway = unusedGateway();
  gateway.listCheckoutSessions = async ({ status }) => status === "complete"
    ? page([session("cs_candidate", FAMILY_ID, "cus_candidate")])
    : page([]);
  gateway.listSubscriptions = async ({ customerId }) => page([
    subscription("sub_unowned_active", "active", customerId, null),
  ]);
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_candidate", null);
  };

  const result = await createStripeAccountDeletionReconciler(gateway)({
    familyId: FAMILY_ID,
    familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
    knownCustomerIds: [],
    knownSubscriptionIds: [],
  });

  assert.deepEqual(canceled, []);
  assert.equal(result.inspectedCustomerCount, 1);
  assert.equal(result.inspectedSubscriptionCount, 1);
});

test("cancels only this family's subscriptions when a Stripe customer is shared", async () => {
  const otherFamilyId = "22222222-2222-4222-8222-222222222222";
  const canceled: string[] = [];
  const gateway = unusedGateway();

  gateway.listSubscriptions = async ({ customerId }) => {
    assert.equal(customerId, "cus_shared");
    return page([
      subscription("sub_family", "active", customerId, FAMILY_ID),
      subscription("sub_other_family", "active", customerId, otherFamilyId),
      subscription("sub_exact_legacy", "active", customerId, null),
    ]);
  };
  gateway.retrieveSubscription = async (id) => {
    assert.equal(id, "sub_exact_legacy");
    return subscription(id, "active", "cus_shared", null);
  };
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(
      id,
      "canceled",
      "cus_shared",
      id === "sub_exact_legacy" ? null : FAMILY_ID,
    );
  };

  const result = await createStripeAccountDeletionReconciler(gateway)({
    familyId: FAMILY_ID,
    familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
    knownCustomerIds: ["cus_shared"],
    knownSubscriptionIds: ["sub_exact_legacy"],
  });

  assert.deepEqual(new Set(canceled), new Set(["sub_family", "sub_exact_legacy"]));
  assert.equal(canceled.length, 2);
  assert.deepEqual(result, {
    expiredCheckoutSessionCount: 0,
    inspectedCustomerCount: 1,
    inspectedSubscriptionCount: 3,
    canceledSubscriptionCount: 2,
    alreadyTerminalSubscriptionCount: 0,
  });
});

test("permits only terminal unowned subscriptions under an exact family customer", async () => {
  const canceled: string[] = [];
  const gateway = unusedGateway();
  gateway.listSubscriptions = async ({ customerId }) => page([
    subscription("sub_unowned_canceled", "canceled", customerId, null),
    subscription("sub_unowned_expired", "incomplete_expired", customerId, null),
  ]);
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_family", null);
  };

  const result = await createStripeAccountDeletionReconciler(gateway)({
    familyId: FAMILY_ID,
    familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
    knownCustomerIds: ["cus_family"],
    knownSubscriptionIds: [],
  });

  assert.deepEqual(canceled, []);
  assert.deepEqual(result, {
    expiredCheckoutSessionCount: 0,
    inspectedCustomerCount: 1,
    inspectedSubscriptionCount: 2,
    canceledSubscriptionCount: 0,
    alreadyTerminalSubscriptionCount: 0,
  });
});

test("fails closed when an exact legacy subscription belongs to another family", async () => {
  const canceled: string[] = [];
  const gateway = unusedGateway();
  gateway.retrieveSubscription = async (id) => subscription(
    id,
    "active",
    "cus_shared",
    "22222222-2222-4222-8222-222222222222",
  );
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_shared");
  };

  await assert.rejects(
    createStripeAccountDeletionReconciler(gateway)({
      familyId: FAMILY_ID,
      familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
      knownCustomerIds: [],
      knownSubscriptionIds: ["sub_conflicting_legacy"],
    }),
    (error: unknown) => error instanceof StripeAccountDeletionUncertainError
      && error.reason === "unexpected_provider_state",
  );
  assert.deepEqual(canceled, []);
});

test("fails closed when list and exact retrieval contradict ownership", async () => {
  const canceled: string[] = [];
  const gateway = unusedGateway();
  gateway.listSubscriptions = async ({ customerId }) => page([
    subscription(
      "sub_overwrite_attempt",
      "active",
      customerId,
      "22222222-2222-4222-8222-222222222222",
    ),
  ]);
  gateway.retrieveSubscription = async (id) => subscription(
    id,
    "active",
    "cus_shared",
    null,
  );
  gateway.cancelSubscription = async (id) => {
    canceled.push(id);
    return subscription(id, "canceled", "cus_shared", null);
  };

  await assert.rejects(
    createStripeAccountDeletionReconciler(gateway)({
      familyId: FAMILY_ID,
      familyCreatedAt: new Date("2026-08-01T00:00:00Z"),
      knownCustomerIds: ["cus_shared"],
      knownSubscriptionIds: ["sub_overwrite_attempt"],
    }),
    (error: unknown) => error instanceof StripeAccountDeletionUncertainError
      && error.reason === "unexpected_provider_state",
  );
  assert.deepEqual(canceled, []);
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
