import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * The recorder says who the lesson is for, in words (gh#353).
 *
 * A sibling switcher already marked the current kid with a highlighted
 * pill. On 2026-07-27 a parent still recorded 28 minutes with her
 * three-year-old while the page was armed for her nine-year-old. A
 * highlighted pill is something you look at, and she was looking at her
 * child, not at the screen.
 *
 * The cost is not a tidy-up: the lesson produces progress evidence that
 * SCORES a child, so a misfiled recording puts a preschool claim on a
 * nine-year-old's record. That is what earns a plain sentence next to
 * the button rather than relying on the selection state alone.
 *
 * Source-level because the assertion is about placement and phrasing,
 * and a render test of this component needs the browser media stack.
 */

const recorder = readFileSync(
  path.join(
    path.resolve(import.meta.dirname, "..", "..", "app", "app", "[childId]", "lessons", "record"),
    "recorder.tsx",
  ),
  "utf8",
);

describe("recorder child confirmation", () => {
  it("names the child in a sentence, not only in a selected pill", () => {
    assert.match(recorder, /This lesson will be saved for/u);
    assert.match(recorder, /\{childName\}/u);
  });

  it("puts it before the start control, where she is looking when she commits", () => {
    const confirmAt = recorder.indexOf("This lesson will be saved for");
    const startAt = recorder.indexOf("Start recording");
    assert.ok(confirmAt > 0 && startAt > 0);
    assert.ok(
      confirmAt < startAt,
      "a confirmation after the button is a receipt, not a check",
    );
  });

  it("stays quiet for an only child, where there is nothing to confuse", () => {
    // Guarded on kids.length > 1, the same condition the switcher uses:
    // a family with one child never picked wrong and does not need to
    // read that they picked right.
    const confirmAt = recorder.indexOf("This lesson will be saved for");
    const guardAt = recorder.lastIndexOf("kids.length > 1", confirmAt);
    assert.ok(guardAt > 0 && confirmAt - guardAt < 800);
  });

  it("keeps the switcher, so noticing the wrong name is one tap from fixing it", () => {
    assert.match(recorder, /Record for which kid/u);
  });
});
