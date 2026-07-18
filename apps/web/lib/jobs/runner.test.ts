import assert from "node:assert/strict";
import test from "node:test";

import { shouldGateStage } from "./runner";

// Gate-first-volume (agent-jobs plan §A2, council recommendation): the
// first stage is the calibration checkpoint that pauses for the parent;
// every later stage free-runs.
test("shouldGateStage gates only the first stage", () => {
  assert.equal(shouldGateStage(1), true);
  assert.equal(shouldGateStage(2), false);
  assert.equal(shouldGateStage(4), false);
  assert.equal(shouldGateStage(36), false);
});
