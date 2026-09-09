import assert from "node:assert/strict";
import { test } from "node:test";

import { CURRICULUM_CATALOG, canonicalCurriculumName, customCurriculumName, searchCurricula, toggleCurriculum } from "./curriculum-catalog";

test("catalog options have unique names, unambiguous aliases, and research sources", () => {
  const keys = new Map<string, string>();
  for (const option of CURRICULUM_CATALOG) {
    assert.match(option.sourceUrl, /^https:\/\//, option.name);
    for (const name of [option.name, ...(option.aliases ?? [])]) {
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      assert.ok(!keys.has(key) || keys.get(key) === option.name, `${name} conflicts with ${keys.get(key)}`);
      keys.set(key, option.name);
    }
  }
});

test("search finds names despite spacing, punctuation, case, or familiar abbreviations", () => {
  for (const [query, expected] of [[" math u see ", "Math-U-See"], ["TGATB", "The Good and the Beautiful"],
    ["IEW", "Institute for Excellence in Writing (IEW)"], ["gather round", "Gather 'Round Homeschool"],
    ["beyond the page", "Moving Beyond the Page"]]) {
    assert.ok(searchCurricula(query).some((item) => item.name === expected), query);
  }
});

test("choosing several subjects retains earlier choices and unchecking removes only that one", () => {
  const first = toggleCurriculum([], "Math-U-See");
  const second = toggleCurriculum(first, "All About Reading");
  const third = toggleCurriculum(second, "Apologia");
  assert.deepEqual(third, ["Math-U-See", "All About Reading", "Apologia"]);
  assert.deepEqual(toggleCurriculum(third, "All About Reading"), ["Math-U-See", "Apologia"]);
  assert.deepEqual(first, ["Math-U-See"]);
});

test("an exact catalog name or alias cannot be added as a duplicate custom entry", () => {
  for (const name of ["math-u-see", " Math U See ", "MUS", "TGATB", "Writing and Rhetoric"]) {
    assert.equal(customCurriculumName(name, []), null, name);
  }
  assert.equal(canonicalCurriculumName("iew"), "Institute for Excellence in Writing (IEW)");
  assert.deepEqual(toggleCurriculum(["Math-U-See"], "MUS"), []);
});

test("custom entries are trimmed, searchable, removable, and not added to the shared catalog", () => {
  const before = CURRICULUM_CATALOG.length;
  const name = customCurriculumName("  Our   co-op curriculum  ", []);
  assert.equal(name, "Our co-op curriculum");
  const selected = toggleCurriculum(["Math-U-See"], name!);
  assert.equal(customCurriculumName("OUR CO OP CURRICULUM", selected), null);
  assert.deepEqual(searchCurricula("our coop", selected).map((item) => item.name), [name]);
  assert.deepEqual(toggleCurriculum(selected, name!), ["Math-U-See"]);
  assert.equal(CURRICULUM_CATALOG.length, before);
  assert.deepEqual(searchCurricula("our coop"), []);
});

test("empty input never becomes a selected curriculum", () => {
  for (const query of ["", "   ", "..."]) {
    assert.equal(customCurriculumName(query, []), null);
    assert.deepEqual(toggleCurriculum([], query), []);
  }
});

test("clearing search restores the full alphabetized list with selected custom entries", () => {
  const selected = ["Math-U-See", "Our co-op curriculum"];
  const all = searchCurricula("", selected);
  assert.equal(all.length, CURRICULUM_CATALOG.length + 1);
  assert.deepEqual(all.map((item) => item.name), all.map((item) => item.name).sort((a, b) => a.localeCompare(b, "en")));
  assert.deepEqual(searchCurricula("no such curriculum xyz", selected), []);
  assert.deepEqual(selected, ["Math-U-See", "Our co-op curriculum"]);
});
