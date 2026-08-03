import assert from "node:assert/strict";
import test from "node:test";

import {
  MutationReceiptError,
  requireMutationAcknowledgement,
  requireMutationReceipt,
  requireReceiptValue,
} from "./mutation-receipt";
import {
  executePlanActivityCheck,
  PlanActivityCheckConflictError,
  type PlanActivityCheckInput,
  type PlanActivityCheckRpcArgs,
} from "./plan-check-mutation";

const planCheckInput: PlanActivityCheckInput = {
  childId: "10000000-0000-4000-8000-000000000001",
  subjectId: "math",
  checkKey: "2.0",
  done: true,
  expectedText: "Count twenty blue buttons",
  planRevision: 4,
};
const FAMILY_ID = "30000000-0000-4000-8000-000000000001";

test("returns the exact durable receipt", () => {
  const receipt = requireMutationReceipt("save_test", {
    data: { id: "row-1" },
    error: null,
  });

  assert.deepEqual(receipt, { id: "row-1" });
});

test("throws on provider errors before a UI can claim success", () => {
  assert.throws(
    () => requireMutationAcknowledgement("save_test", { message: "offline" }),
    (error: unknown) =>
      error instanceof MutationReceiptError &&
      error.operation === "save_test" &&
      error.reason === "provider_error",
  );
});

test("throws when an update or delete returns no row receipt", () => {
  assert.throws(
    () => requireMutationReceipt("save_test", { data: null, error: null }),
    (error: unknown) =>
      error instanceof MutationReceiptError &&
      error.reason === "missing_receipt",
  );
});

test("throws when read-back state contradicts the requested effect", () => {
  assert.throws(
    () => requireReceiptValue("toggle_test", false),
    (error: unknown) =>
      error instanceof MutationReceiptError &&
      error.reason === "contradictory_receipt",
  );
});

test("accepts one complete applied receipt without a follow-up read", async () => {
  const calls: PlanActivityCheckRpcArgs[] = [];
  const outcome = await executePlanActivityCheck(async (args) => {
    calls.push(args);
    return {
      data: {
        status: "applied",
        reason: null,
        family_id: FAMILY_ID,
        plan_id: "20000000-0000-4000-8000-000000000001",
        plan_revision: 4,
        progress_revision: 9,
        progress_snapshot: { "1.0": false, "2.0": true },
        progress_key: "2.0",
        done: true,
        changed: true,
      },
      error: null,
    };
  }, planCheckInput);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    target_child_id: planCheckInput.childId,
    target_subject_id: "math",
    target_check_key: "2.0",
    target_done: true,
    target_expected_text: "Count twenty blue buttons",
    target_plan_revision: 4,
  });
  assert.deepEqual(outcome, {
    status: "applied",
    reason: null,
    familyId: FAMILY_ID,
    planId: "20000000-0000-4000-8000-000000000001",
    planRevision: 4,
    progressRevision: 9,
    progressSnapshot: { "1.0": false, "2.0": true },
    progressKey: "2.0",
    done: true,
    changed: true,
  });
});

test("never replays the native set after a lost receipt", async () => {
  const calls: PlanActivityCheckRpcArgs[] = [];
  await assert.rejects(
    () => executePlanActivityCheck(async (args) => {
      calls.push(args);
      throw new Error("receipt lost after commit");
    }, planCheckInput),
    /receipt lost after commit/u,
  );

  assert.equal(calls.length, 1);
});

test("returns a typed stale conflict suitable for a refresh error", async () => {
  const outcome = await executePlanActivityCheck(async () => ({
    data: {
      status: "conflict",
      reason: "revision-mismatch",
      family_id: FAMILY_ID,
      plan_id: "20000000-0000-4000-8000-000000000001",
      plan_revision: 5,
      progress_revision: 10,
      progress_snapshot: { "2.0": false },
      progress_key: "2.0",
      done: null,
      changed: null,
    },
    error: null,
  }), planCheckInput);

  assert.equal(outcome.status, "conflict");
  assert.equal(outcome.reason, "revision-mismatch");
  assert.equal(outcome.planRevision, 5);
  assert.equal(outcome.progressRevision, 10);
  const error = new PlanActivityCheckConflictError(outcome);
  assert.equal(error.outcome.reason, "revision-mismatch");
});

test("rejects an applied receipt for a different plan revision", async () => {
  await assert.rejects(
    () => executePlanActivityCheck(async () => ({
      data: {
        status: "applied",
        reason: null,
        family_id: FAMILY_ID,
        plan_id: "20000000-0000-4000-8000-000000000001",
        plan_revision: 5,
        progress_revision: 9,
        progress_snapshot: { "2.0": true },
        progress_key: "2.0",
        done: true,
        changed: true,
      },
      error: null,
    }), planCheckInput),
    (error: unknown) =>
      error instanceof MutationReceiptError &&
      error.operation === "set_plan_activity_check_v2" &&
      error.reason === "contradictory_receipt",
  );
});

test("rejects malformed or contradictory plan check receipts", async () => {
  await assert.rejects(
    () => executePlanActivityCheck(async () => ({
      data: {
        status: "applied",
        reason: null,
        family_id: FAMILY_ID,
        plan_id: "20000000-0000-4000-8000-000000000001",
        plan_revision: 4,
        progress_revision: 9,
        progress_snapshot: { "2.0": false },
        progress_key: "2.0",
        done: true,
        changed: true,
      },
      error: null,
    }), planCheckInput),
    (error: unknown) =>
      error instanceof MutationReceiptError &&
      error.operation === "set_plan_activity_check_v2" &&
      error.reason === "contradictory_receipt",
  );
});
