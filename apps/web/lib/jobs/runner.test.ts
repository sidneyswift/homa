import assert from "node:assert/strict";
import test from "node:test";

import {
  completeBeforeMilestoneDelivery,
  STALE_STAGE_TIMEOUT_MS,
  shouldGateStage,
  staleStageLeaseCutoff,
} from "./runner";

test("a completed artifact becomes ready before milestone delivery returns", async () => {
  const calls: string[] = [];
  let releaseDelivery!: (runId: string) => void;
  const delivery = new Promise<string>((resolve) => {
    releaseDelivery = resolve;
  });

  const completion = completeBeforeMilestoneDelivery({
    markCompleted: async () => {
      calls.push("completed");
    },
    deliver: async () => {
      calls.push("delivery-started");
      return delivery;
    },
    attachDelivery: async (runId) => {
      calls.push(`delivery-attached:${runId}`);
    },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["completed", "delivery-started"]);

  releaseDelivery("task-run-1");
  await completion;
  assert.deepEqual(calls, [
    "completed",
    "delivery-started",
    "delivery-attached:task-run-1",
  ]);
});

// Gating is the contract's decision (agent-jobs plan §A2, council
// recommendation): curriculum-studio gates its first volume as the
// calibration checkpoint that pauses for the parent, and every later
// stage free-runs.
test("curriculum-studio gates only the first stage", () => {
  assert.equal(shouldGateStage("curriculum-studio", 1), true);
  assert.equal(shouldGateStage("curriculum-studio", 2), false);
  assert.equal(shouldGateStage("curriculum-studio", 4), false);
  assert.equal(shouldGateStage("curriculum-studio", 36), false);
});

// A single-page materials build never gates: the promise made at start
// time is that the finished page lands on its own, and a review pause
// would turn it into a chore she never asked for.
test("materials-studio never gates", () => {
  assert.equal(shouldGateStage("materials-studio", 1), false);
  assert.equal(shouldGateStage("materials-studio", 2), false);
});

// A job whose skill has since left the registry falls back to the
// conservative default: gate the first stage rather than free-run work
// nobody can steer.
test("an unregistered skill falls back to gating stage one", () => {
  assert.equal(shouldGateStage("retired-skill", 1), true);
  assert.equal(shouldGateStage("retired-skill", 2), false);
});

// The reaper's timeout decision: how far back the stale-lease cutoff sits.
// A stage whose in_progress lease predates this instant is treated as
// abandoned (its serverless build was hard-killed without firing the
// turn/session events that normally release it). Kept pure so it is testable
// without a database, the way shouldGateStage is.
test("staleStageLeaseCutoff subtracts the timeout from now", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");
  // Explicit timeout: 20 minutes back.
  assert.equal(
    staleStageLeaseCutoff(now, 20 * 60 * 1000).toISOString(),
    "2026-07-19T11:40:00.000Z",
  );
  // The default is the 20-minute production timeout.
  assert.equal(STALE_STAGE_TIMEOUT_MS, 20 * 60 * 1000);
  assert.equal(
    staleStageLeaseCutoff(now).toISOString(),
    "2026-07-19T11:40:00.000Z",
  );
});
