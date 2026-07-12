import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  executeChildProgressReconciliation,
  type ChildProgressReconciliationDatabase,
} from "./reconcile-child-progress-lib";
import {
  CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY,
} from "../apps/web/lib/child-progress/postgres-repository-helpers";

function fakeDatabase(calls: string[]): ChildProgressReconciliationDatabase {
  return {
    async withTransaction(operation) {
      calls.push("begin");
      try {
        const result = await operation({
          async acquireExclusiveLock(lockKey) {
            calls.push(`lock:${lockKey}`);
          },
          async reconcile() {
            calls.push("reconcile");
            return {
              insertedCount: BigInt(3),
              supersededCount: BigInt(2),
            };
          },
        });
        calls.push("commit");
        return result;
      } catch (error) {
        calls.push("rollback");
        throw error;
      }
    },
  };
}

describe("child progress reconciliation command", () => {
  it("takes the migration lock before invoking reconciliation", async () => {
    const calls: string[] = [];

    const result = await executeChildProgressReconciliation({
      database: fakeDatabase(calls),
      dryRun: false,
    });

    assert.deepEqual(calls, [
      "begin",
      `lock:${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}`,
      "reconcile",
      "commit",
    ]);
    assert.deepEqual(result, {
      mode: "commit",
      insertedCount: BigInt(3),
      supersededCount: BigInt(2),
      status: "reconciled",
    });
  });

  it("runs the exact reconciliation and rolls every write back in dry-run mode", async () => {
    const calls: string[] = [];

    const result = await executeChildProgressReconciliation({
      database: fakeDatabase(calls),
      dryRun: true,
    });

    assert.deepEqual(calls, [
      "begin",
      `lock:${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}`,
      "reconcile",
      "rollback",
    ]);
    assert.deepEqual(result, {
      mode: "dry-run",
      insertedCount: BigInt(3),
      supersededCount: BigInt(2),
      status: "rolled_back",
    });
  });
});
