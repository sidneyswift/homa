import assert from "node:assert/strict";
import test from "node:test";

import {
  WALL_STALE_LESSON_LINE,
  wallIncludedLine,
} from "./wall-copy";

test("lesson wall copy names the tapped lesson and printable worksheet", () => {
  assert.match(
    wallIncludedLine("lesson", "Maya"),
    /lesson.*printable worksheet/i,
  );
});

test("lesson stale copy reassures before offering the next step", () => {
  assert.equal(
    WALL_STALE_LESSON_LINE,
    "Your report is safe. Refreshing this page will reopen the lesson option.",
  );
});

test("lesson does not rename the existing month or legacy plan doors", () => {
  assert.match(wallIncludedLine("month", "Maya"), /Maya's month/);
  assert.match(
    wallIncludedLine("plan", "Maya"),
    /four-week plan/i,
  );
});
