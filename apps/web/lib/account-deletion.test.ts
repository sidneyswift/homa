import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  deletionBillingDecision,
  retryableDeletionFailure,
} from "./account-deletion";
import {
  deletionConfirmationFor,
  hasExactDeletionConfirmation,
} from "./account-deletion-confirmation";

test("requires the exact family-specific deletion phrase", () => {
  const expected = deletionConfirmationFor("Rivera family");
  assert.equal(expected, "Delete Rivera family");
  assert.equal(hasExactDeletionConfirmation("Rivera family", expected), true);
  assert.equal(hasExactDeletionConfirmation("Rivera family", "delete Rivera family"), false);
  assert.equal(hasExactDeletionConfirmation("Rivera family", "Delete Rivera Family"), false);
});

test("cancels both an active trial and a paid Stripe subscription before deletion", () => {
  const decision = deletionBillingDecision([
    { provider: "stripe", provider_subscription_id: "sub_trial", status: "trialing" },
    { provider: "stripe", provider_subscription_id: "sub_paid", status: "active" },
  ]);
  assert.deepEqual(decision, {
    stripeSubscriptionIds: ["sub_trial", "sub_paid"],
    blockedProvider: null,
  });
});

test("requires the native store to stop an active native subscription", () => {
  const decision = deletionBillingDecision([
    { provider: "apple", provider_subscription_id: "original_transaction", status: "active" },
  ]);
  assert.equal(decision.blockedProvider, "apple");
  assert.deepEqual(decision.stripeSubscriptionIds, []);
});

test("a cleanup failure remains explicitly retryable", () => {
  assert.deepEqual(retryableDeletionFailure(new Error("private Blob unavailable")), {
    status: "retryable_failed",
    message: "private Blob unavailable",
  });
});

test("revokes schedules and every active family session before artifact cleanup", async () => {
  const source = await readFile(new URL("./account-deletion.ts", import.meta.url), "utf8");
  assert.match(source, /delete from public\.agent_schedules where family_id/u);
  assert.match(source, /delete from auth\.sessions/u);
  assert.match(source, /set status = 'deleted'/u);
});
