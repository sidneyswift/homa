import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FourWeekPlan } from "@homa/core";

import { remapProgressForRebuiltPlan } from "./plan-progress-remap";

function plan(
  weeks: Array<{ week: number; activities: string[] }>,
): Pick<FourWeekPlan, "weeks"> {
  return { weeks } as Pick<FourWeekPlan, "weeks">;
}

describe("remapProgressForRebuiltPlan", () => {
  it("moves a check only with its exact unique activity text", () => {
    const result = remapProgressForRebuiltPlan(
      plan([
        { week: 1, activities: ["Count the red blocks.", "Read together."] },
        { week: 2, activities: ["Sing the number song."] },
      ]),
      plan([
        { week: 1, activities: ["Try a new puzzle."] },
        { week: 3, activities: ["Read together.", "Count the red blocks."] },
      ]),
      { "1.0": true, "1.1": false, "2.0": true },
    );

    assert.deepEqual(result.progress, { "3.1": true, "3.0": false });
    assert.equal(result.archivedDoneCount, 2);
    assert.equal(result.preservedDoneCount, 1);
    assert.equal(result.archivedUnmatchedDoneCount, 1);
  });

  it("refuses duplicate text on either side instead of guessing", () => {
    const result = remapProgressForRebuiltPlan(
      plan([{ week: 1, activities: ["Read together.", "Read together."] }]),
      plan([{ week: 2, activities: ["Read together."] }]),
      { "1.0": true },
    );
    assert.deepEqual(result.progress, {});
    assert.equal(result.archivedUnmatchedDoneCount, 1);
  });

  it("does not normalize near matches or attach an invalid old key", () => {
    const result = remapProgressForRebuiltPlan(
      plan([{ week: 1, activities: ["Count ten buttons."] }]),
      plan([{ week: 1, activities: ["Count ten buttons. "] }]),
      { "1.0": true, "9.9": true },
    );
    assert.deepEqual(result.progress, {});
    assert.equal(result.archivedDoneCount, 2);
    assert.equal(result.preservedDoneCount, 0);
  });
});
