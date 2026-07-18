import assert from "node:assert/strict";
import test from "node:test";

import { CURRICULUM_CATEGORIES, findCurriculumProfiles } from "./atlas";

test("a named curriculum resolves to its atlas profile", () => {
  const matches = findCurriculumProfiles({ text: "All About Reading" });
  assert.ok(matches.length >= 1);
  assert.equal(matches[0].id, "all-about-learning");
  assert.equal(matches[0].masteryOrSpiral, "mastery");
});

test("an exact id returns just that profile", () => {
  const matches = findCurriculumProfiles({ id: "all-about-learning" });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].name, "All About Reading + All About Spelling");
});

test("facets filter and the limit is honored", () => {
  const matches = findCurriculumProfiles({
    category: "math",
    religiousOrientation: "secular",
    limit: 3,
  });
  assert.ok(matches.length > 0 && matches.length <= 3);
  for (const m of matches) {
    assert.equal(m.category, "math");
    assert.equal(m.religiousOrientation, "secular");
  }
});

test("a no-match query returns empty, never throws", () => {
  assert.deepEqual(findCurriculumProfiles({ text: "zzz-not-a-real-curriculum" }), []);
});

test("categories are exposed for the tool enum", () => {
  assert.ok(CURRICULUM_CATEGORIES.includes("math"));
  assert.ok(CURRICULUM_CATEGORIES.includes("language-arts"));
});
