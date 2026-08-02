import assert from "node:assert/strict";
import test from "node:test";

import {
  MutationReceiptError,
  requireMutationAcknowledgement,
  requireMutationReceipt,
  requireReceiptValue,
} from "./mutation-receipt";

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
