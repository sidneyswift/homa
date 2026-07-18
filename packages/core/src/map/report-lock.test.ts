import assert from "node:assert/strict";
import test from "node:test";

import type { MapScores, SubjectScore } from "./scoring";
import {
  freeReportSubjects,
  lockedReportSubjects,
  REPORT_LOCK_CORE_SUBJECTS,
  REPORT_LOCK_FREE_COUNT,
} from "./report-lock";

function subject(subjectId: string, position: SubjectScore["position"]): SubjectScore {
  return {
    subjectId,
    position,
    monthsAhead: position === "ahead" ? 4 : position === "on_track" ? 1 : null,
    frontierDeltaMonths: null,
    beyondScale: false,
    highConfidence: true,
    observations: position === "not_mapped" ? 0 : 3,
    strongestObservedStatement: null,
    strongestObservedMonths: null,
    frontierStatement: null,
    frontierItemId: null,
    frontierDomain: null,
    exposureBased: false,
  };
}

function scores(entries: [string, SubjectScore["position"]][], strengthOrder: string[]): MapScores {
  const subjects = entries.map(([id, position]) => subject(id, position));
  return {
    subjects,
    strengthOrder,
    mappedCount: subjects.filter((s) => s.position !== "not_mapped").length,
    totalSubjects: subjects.length,
    observationCount: subjects.reduce((sum, s) => sum + s.observations, 0),
  };
}

test("fixed core renders open when every core subject is mapped", () => {
  const input = scores(
    [
      ["math", "ahead"],
      ["literacy", "on_track"],
      ["science", "on_track"],
      ["social_emotional", "growing"],
      ["phonics", "ahead"],
      ["writing", "growing"],
    ],
    ["math", "phonics", "literacy", "science", "writing", "social_emotional"],
  );
  assert.deepEqual(
    [...freeReportSubjects(input)].sort(),
    [...REPORT_LOCK_CORE_SUBJECTS].sort(),
  );
  assert.deepEqual(lockedReportSubjects(input).sort(), ["phonics", "writing"]);
});

test("an unmapped core slot fills from strengthOrder, never with an empty row", () => {
  const input = scores(
    [
      ["math", "ahead"],
      ["literacy", "on_track"],
      ["science", "not_mapped"],
      ["social_emotional", "on_track"],
      ["phonics", "ahead"],
      ["gross_motor", "on_track"],
    ],
    ["math", "phonics", "gross_motor", "literacy", "social_emotional"],
  );
  const free = freeReportSubjects(input);
  assert.equal(free.length, REPORT_LOCK_FREE_COUNT);
  assert.ok(!free.includes("science"), "not-mapped core subject must not spend a free slot");
  assert.ok(free.includes("phonics"), "strongest mapped non-core subject fills the slot");
  assert.deepEqual(lockedReportSubjects(input), ["gross_motor"]);
});

test("four or fewer mapped subjects means nothing locks", () => {
  const input = scores(
    [
      ["math", "ahead"],
      ["writing", "growing"],
      ["music", "on_track"],
      ["science", "not_mapped"],
      ["spanish", "not_mapped"],
    ],
    ["math", "music", "writing"],
  );
  assert.deepEqual([...freeReportSubjects(input)].sort(), ["math", "music", "writing"]);
  assert.deepEqual(lockedReportSubjects(input), []);
});

test("deterministic: same scores give the same four", () => {
  const input = scores(
    [
      ["math", "ahead"],
      ["literacy", "on_track"],
      ["science", "on_track"],
      ["social_emotional", "growing"],
      ["phonics", "ahead"],
    ],
    ["math", "phonics", "literacy", "science", "social_emotional"],
  );
  assert.deepEqual(freeReportSubjects(input), freeReportSubjects(input));
});

test("not-mapped subjects are never reported as locked", () => {
  const input = scores(
    [
      ["math", "ahead"],
      ["literacy", "on_track"],
      ["science", "on_track"],
      ["social_emotional", "on_track"],
      ["phonics", "ahead"],
      ["spanish", "not_mapped"],
      ["computer_science", "not_mapped"],
    ],
    ["math", "phonics", "literacy", "science", "social_emotional"],
  );
  const locked = lockedReportSubjects(input);
  assert.ok(!locked.includes("spanish"));
  assert.ok(!locked.includes("computer_science"));
  assert.deepEqual(locked, ["phonics"]);
});
