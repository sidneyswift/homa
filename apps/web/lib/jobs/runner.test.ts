import assert from "node:assert/strict";
import test from "node:test";

import {
  STALE_STAGE_TIMEOUT_MS,
  shouldGateStage,
  staleStageLeaseCutoff,
} from "./runner";

// Gate-first-volume (agent-jobs plan §A2, council recommendation): the
// first stage is the calibration checkpoint that pauses for the parent;
// every later stage free-runs.
test("shouldGateStage gates only the first stage", () => {
  assert.equal(shouldGateStage(1), true);
  assert.equal(shouldGateStage(2), false);
  assert.equal(shouldGateStage(4), false);
  assert.equal(shouldGateStage(36), false);
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
