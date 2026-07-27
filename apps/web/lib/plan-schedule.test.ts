import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FourWeekPlan } from "@homa/core";

import { activityTextAt, validateScheduleInput } from "./plan-schedule";

/**
 * The pure guts of schedule_plan_activity (issue #176, CG-03): input
 * bounds checking, and reading an activity's own text fresh from the
 * plan rather than trusting a cached copy. Both write paths
 * (schedulePlanActivityCaller and schedulePlanActivityPinned) share
 * these, so a bug here would otherwise need two separate integration
 * tests against a real database to catch.
 */

function plan(overrides: Partial<FourWeekPlan> = {}): FourWeekPlan {
  return {
    subjectId: "math",
    subjectName: "Math",
    childAgeLabel: "6 years",
    startingLine: null,
    targets: ["counts to 20"],
    weeks: [
      { week: 1, focus: "counting", activities: ["Count to 20 daily", "Play a counting game"] },
      { week: 2, focus: "counting", activities: ["Count objects around the house"] },
    ],
    styleNote: null,
    bankVersion: "test",
    ...overrides,
  };
}

describe("activityTextAt", () => {
  it("reads the activity's own text at a real week and index", () => {
    assert.equal(activityTextAt(plan(), 1, 0), "Count to 20 daily");
    assert.equal(activityTextAt(plan(), 1, 1), "Play a counting game");
    assert.equal(activityTextAt(plan(), 2, 0), "Count objects around the house");
  });

  it("returns null for a week that does not exist in this plan", () => {
    assert.equal(activityTextAt(plan(), 3, 0), null);
  });

  it("returns null for an out-of-bounds activity index, the known post-edit shift case", () => {
    assert.equal(activityTextAt(plan(), 1, 5), null);
    // Week 2 only has one activity (index 0); index 1 no longer exists,
    // exactly the shape left behind by an edit_plan removal earlier in
    // the week (the plan_activity_schedule migration's documented
    // known limitation).
    assert.equal(activityTextAt(plan(), 2, 1), null);
  });
});

describe("validateScheduleInput", () => {
  const base = {
    childId: "11111111-1111-1111-1111-111111111111",
    subjectId: "math",
    week: 1,
    activityIndex: 0,
    scheduledDate: "2026-08-04",
  };

  it("accepts a well-formed input", () => {
    assert.deepEqual(validateScheduleInput(base), { ok: true });
  });

  it("rejects a malformed date", () => {
    const result = validateScheduleInput({ ...base, scheduledDate: "Tuesday" });
    assert.equal(result.ok, false);
  });

  it("rejects a week outside 1 through 4", () => {
    assert.equal(validateScheduleInput({ ...base, week: 0 }).ok, false);
    assert.equal(validateScheduleInput({ ...base, week: 5 }).ok, false);
  });

  it("rejects a negative or non-integer activity index", () => {
    assert.equal(validateScheduleInput({ ...base, activityIndex: -1 }).ok, false);
    assert.equal(validateScheduleInput({ ...base, activityIndex: 1.5 }).ok, false);
  });
});
