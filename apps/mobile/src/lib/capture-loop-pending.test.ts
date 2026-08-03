import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  forgetPendingNativeScheduleOutcome,
  loadPendingNativeScheduleOutcomes,
  reconcilePendingNativeScheduleOutcomes,
  rememberPendingNativeScheduleOutcome,
  type PendingOutcomeStorage,
} from "./capture-loop-pending";

const LOOP_A = "11111111-1111-4111-8111-111111111111";
const LOOP_B = "22222222-2222-4222-8222-222222222222";
const RECEIPT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RECEIPT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function memoryStorage(): PendingOutcomeStorage {
  const values = new Map<string, string>();
  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

describe("pending native capture-loop outcomes", () => {
  it("upserts one recovery pointer per loop", async () => {
    const storage = memoryStorage();
    await rememberPendingNativeScheduleOutcome(
      "family-a",
      { loopId: LOOP_A, receiptId: RECEIPT_A },
      storage,
    );
    await rememberPendingNativeScheduleOutcome(
      "family-a",
      { loopId: LOOP_A, receiptId: RECEIPT_B },
      storage,
    );
    assert.deepEqual(
      await loadPendingNativeScheduleOutcomes("family-a", storage),
      [{ loopId: LOOP_A, receiptId: RECEIPT_B }],
    );
  });

  it("reconciles verified pointers and retains failed ones", async () => {
    const storage = memoryStorage();
    await rememberPendingNativeScheduleOutcome(
      "family-a",
      { loopId: LOOP_A, receiptId: RECEIPT_A },
      storage,
    );
    await rememberPendingNativeScheduleOutcome(
      "family-a",
      { loopId: LOOP_B, receiptId: RECEIPT_B },
      storage,
    );
    const attempted: string[] = [];
    await reconcilePendingNativeScheduleOutcomes(
      "family-a",
      async (loopId) => {
        attempted.push(loopId);
        return loopId === LOOP_A;
      },
      storage,
    );
    assert.deepEqual(attempted, [LOOP_A, LOOP_B]);
    assert.deepEqual(
      await loadPendingNativeScheduleOutcomes("family-a", storage),
      [{ loopId: LOOP_B, receiptId: RECEIPT_B }],
    );
  });

  it("keeps families isolated and supports explicit removal", async () => {
    const storage = memoryStorage();
    await rememberPendingNativeScheduleOutcome(
      "family-a",
      { loopId: LOOP_A, receiptId: RECEIPT_A },
      storage,
    );
    await rememberPendingNativeScheduleOutcome(
      "family-b",
      { loopId: LOOP_B, receiptId: RECEIPT_B },
      storage,
    );
    await forgetPendingNativeScheduleOutcome("family-a", LOOP_A, storage);
    assert.deepEqual(await loadPendingNativeScheduleOutcomes("family-a", storage), []);
    assert.deepEqual(
      await loadPendingNativeScheduleOutcomes("family-b", storage),
      [{ loopId: LOOP_B, receiptId: RECEIPT_B }],
    );
  });
});
