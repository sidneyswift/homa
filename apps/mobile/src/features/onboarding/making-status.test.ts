import assert from "node:assert/strict";
import test from "node:test";

import { firstMakingStopped } from "./making-status";

test("a build the runner parked stops the wait", () => {
  assert.equal(firstMakingStopped("paused"), true);
  assert.equal(firstMakingStopped("failed"), true);
  assert.equal(firstMakingStopped("cancelled"), true);
});

test("a build still in line or underway keeps the wait going", () => {
  for (const status of ["queued", "running", "completed", "awaiting_input", null, undefined]) {
    assert.equal(firstMakingStopped(status), false, String(status));
  }
});
