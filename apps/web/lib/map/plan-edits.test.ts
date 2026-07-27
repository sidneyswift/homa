import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FourWeekPlan } from "@homa/core";

import {
  applyPlanEdits,
  describePlanEdits,
  MAX_ACTIVITIES_PER_WEEK,
  scheduleRemapForEdits,
} from "./plan-edits";

/**
 * The check-off map is keyed "week.activityIndex" (use-plan-checks.ts),
 * so the edit engine's whole job is keeping those keys honest while
 * activities move. Every remap rule gets a case here; the store write
 * is a thin wrapper around this pure function.
 */

function fixturePlan(): FourWeekPlan {
  return {
    subjectId: "math",
    subjectName: "Math",
    childAgeLabel: "6 years",
    startingLine: null,
    targets: ["count to 100"],
    weeks: [
      { week: 1, focus: "counting", activities: ["dice game", "count stairs", "shop math"] },
      { week: 2, focus: "sorting", activities: ["sort socks"] },
      { week: 3, focus: "adding", activities: ["card game", "snack math"] },
      { week: 4, focus: "review", activities: ["retest walk"] },
    ],
    styleNote: null,
    bankVersion: "test",
  };
}

describe("applyPlanEdits", () => {
  it("appends on add and leaves every check alone", () => {
    const progress = { "1.0": true, "1.2": true };
    const result = applyPlanEdits(fixturePlan(), progress, [
      { action: "add", week: 1, text: "count the mail" },
    ]);
    assert.ok(result.ok);
    assert.deepEqual(result.result.plan.weeks[0].activities, [
      "dice game",
      "count stairs",
      "shop math",
      "count the mail",
    ]);
    assert.deepEqual(result.result.progress, progress);
    assert.equal(result.result.added, 1);
  });

  it("replaces in place and clears only that activity's check", () => {
    const result = applyPlanEdits(fixturePlan(), { "1.1": true, "1.2": true }, [
      { action: "replace", week: 1, index: 1, text: "count the stairs backwards" },
    ]);
    assert.ok(result.ok);
    assert.equal(result.result.plan.weeks[0].activities[1], "count the stairs backwards");
    assert.deepEqual(result.result.progress, { "1.2": true });
    assert.equal(result.result.replaced, 1);
  });

  it("remaps later checks down when an activity is removed", () => {
    const result = applyPlanEdits(
      fixturePlan(),
      { "1.0": true, "1.1": true, "1.2": true, "3.1": true },
      [{ action: "remove", week: 1, index: 1 }],
    );
    assert.ok(result.ok);
    assert.deepEqual(result.result.plan.weeks[0].activities, ["dice game", "shop math"]);
    // 1.0 stays, 1.1 (the removed slot) drops, 1.2 slides into 1.1, and
    // week 3's key is untouched.
    assert.deepEqual(result.result.progress, { "1.0": true, "1.1": true, "3.1": true });
    assert.equal(result.result.removed, 1);
  });

  it("applies a batch in order so later indices see earlier edits", () => {
    const result = applyPlanEdits(fixturePlan(), {}, [
      { action: "remove", week: 3, index: 0 },
      { action: "replace", week: 3, index: 0, text: "snack math with pretzels" },
    ]);
    assert.ok(result.ok);
    assert.deepEqual(result.result.plan.weeks[2].activities, ["snack math with pretzels"]);
  });

  it("fails the whole batch when any edit is invalid, mutating nothing", () => {
    const plan = fixturePlan();
    const progress = { "1.0": true };
    const result = applyPlanEdits(plan, progress, [
      { action: "add", week: 1, text: "a fine activity" },
      { action: "remove", week: 2, index: 5 },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.failure.code, "unknown_activity");
    // The caller's plan object never mutates, even for the valid first edit.
    assert.deepEqual(plan.weeks[0].activities, ["dice game", "count stairs", "shop math"]);
    assert.deepEqual(progress, { "1.0": true });
  });

  it("rejects a week the plan does not have", () => {
    const result = applyPlanEdits(fixturePlan(), {}, [
      { action: "add", week: 5 as number, text: "no such week" },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.failure.code, "unknown_week");
  });

  it("caps a week's activity count", () => {
    const plan = fixturePlan();
    plan.weeks[1].activities = Array.from(
      { length: MAX_ACTIVITIES_PER_WEEK },
      (_, index) => `activity ${index}`,
    );
    const result = applyPlanEdits(plan, {}, [
      { action: "add", week: 2, text: "one too many" },
    ]);
    assert.equal(result.ok, false);
  });
});

describe("describePlanEdits", () => {
  it("groups by week with plain verbs", () => {
    const summary = describePlanEdits([
      { action: "add", week: 1, text: "a" },
      { action: "add", week: 1, text: "b" },
      { action: "remove", week: 3, index: 0 },
    ]);
    assert.equal(summary, "added 2 activities in week 1; removed 1 in week 3");
  });

  it("singularizes one addition", () => {
    assert.equal(
      describePlanEdits([{ action: "add", week: 2, text: "a" }]),
      "added 1 activity in week 2",
    );
  });
});

describe("scheduleRemapForEdits", () => {
  it("returns nothing when no activity was removed", () => {
    assert.deepEqual(
      scheduleRemapForEdits(fixturePlan(), [
        { action: "add", week: 1, text: "new one" },
        { action: "replace", week: 1, index: 0, text: "reworded" },
      ]),
      [],
    );
  });

  it("retires the removed index and slides later ones down", () => {
    // Week 1 holds three activities; removing index 0 means the calendar
    // row for index 1 must become index 0, or it would describe a
    // different activity on the same day.
    assert.deepEqual(scheduleRemapForEdits(fixturePlan(), [{ action: "remove", week: 1, index: 0 }]), [
      { week: 1, moves: [{ from: 0, to: null }, { from: 1, to: 0 }, { from: 2, to: 1 }] },
    ]);
  });

  it("leaves earlier indices alone when a later one is removed", () => {
    assert.deepEqual(scheduleRemapForEdits(fixturePlan(), [{ action: "remove", week: 1, index: 2 }]), [
      { week: 1, moves: [{ from: 2, to: null }] },
    ]);
  });

  it("composes two removals, addressing the live shape like the plan does", () => {
    // After removing index 0, the original index 1 sits at live index 0,
    // so a second remove of index 0 retires the ORIGINAL index 1.
    assert.deepEqual(
      scheduleRemapForEdits(fixturePlan(), [
        { action: "remove", week: 1, index: 0 },
        { action: "remove", week: 1, index: 0 },
      ]),
      [{ week: 1, moves: [{ from: 0, to: null }, { from: 1, to: null }, { from: 2, to: 0 }] }],
    );
  });

  it("keeps weeks independent", () => {
    const remaps = scheduleRemapForEdits(fixturePlan(), [
      { action: "remove", week: 1, index: 0 },
      { action: "remove", week: 3, index: 0 },
    ]);
    assert.deepEqual(remaps.map((remap) => remap.week).sort(), [1, 3]);
    assert.deepEqual(
      remaps.find((remap) => remap.week === 3)!.moves,
      [{ from: 0, to: null }, { from: 1, to: 0 }],
    );
  });

  it("ignores a week the plan does not have", () => {
    assert.deepEqual(scheduleRemapForEdits(fixturePlan(), [{ action: "remove", week: 9, index: 0 }]), []);
  });
});
