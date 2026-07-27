import assert from "node:assert/strict";
import test from "node:test";

import { makingPhaseFor } from "./making-status";

// The promise card's honesty depends on this mapping: "ready" may only
// ever appear when there is a real page to show.
test("a completed job with a material is ready", () => {
  assert.equal(makingPhaseFor("completed", true), "ready");
});

test("a completed job with no linked material reads stalled, never ready", () => {
  assert.equal(makingPhaseFor("completed", false), "stalled");
});

test("queued and running jobs are still making", () => {
  assert.equal(makingPhaseFor("queued", false), "making");
  assert.equal(makingPhaseFor("running", false), "making");
  assert.equal(makingPhaseFor("awaiting_input", false), "making");
});

test("a paused job is stalled", () => {
  assert.equal(makingPhaseFor("paused", false), "stalled");
});

test("a cancelled job is stopped, not a snag", () => {
  assert.equal(makingPhaseFor("cancelled", false), "stopped");
});

test("an unknown status parks rather than promising", () => {
  assert.equal(makingPhaseFor("some_future_status", false), "stalled");
  // Even with a material attached: an unknown status is not "ready".
  assert.equal(makingPhaseFor("some_future_status", true), "stalled");
});
