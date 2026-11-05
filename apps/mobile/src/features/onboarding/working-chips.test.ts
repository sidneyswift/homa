import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_SUBJECTS } from "@homa/core";

import {
  focusSubjectIds,
  joinNatural,
  WORKING_CHIP_SUBJECTS,
  workingChipsForAge,
} from "./working-chips";

const SUBJECT_IDS = new Set(MAP_SUBJECTS.map((subject) => subject.id));
const ALL_CHIPS = [...new Set([4, 7, 11, null].flatMap(workingChipsForAge))];

describe("working chips", () => {
  it("maps every chip but the escape chip to real checklist subjects", () => {
    for (const chip of ALL_CHIPS) {
      if (chip === "I'm not sure yet") continue;
      const subjects = WORKING_CHIP_SUBJECTS[chip];
      assert.ok(subjects?.length, `${chip} has no subjects`);
      for (const id of subjects) assert.ok(SUBJECT_IDS.has(id), `${chip} -> ${id}`);
    }
  });

  it("reads one chip back", () => {
    assert.deepEqual(focusSubjectIds("Reading"), ["literacy", "phonics"]);
  });

  it("keeps the order she tapped", () => {
    assert.deepEqual(focusSubjectIds(joinNatural(["Math", "Reading"])), [
      "math",
      "literacy",
      "phonics",
    ]);
  });

  it("treats a chip with 'and' in it as one chip", () => {
    assert.deepEqual(
      focusSubjectIds(joinNatural(["Shapes and colors", "Letters", "Handwriting"])),
      ["math", "literacy", "phonics", "writing"],
    );
  });

  it("does not read Reading out of First reading as a second pick", () => {
    assert.deepEqual(focusSubjectIds("First reading and Counting"), [
      "literacy",
      "phonics",
      "math",
    ]);
  });

  it("returns nothing for the escape chip, a blank or a typed focus", () => {
    assert.deepEqual(focusSubjectIds("I'm not sure yet"), []);
    assert.deepEqual(focusSubjectIds(null), []);
    assert.deepEqual(focusSubjectIds("long division"), []);
  });
});
