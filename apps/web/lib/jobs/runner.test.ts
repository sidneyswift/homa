import assert from "node:assert/strict";
import test from "node:test";

import { shouldGateStage } from "./runner";

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
