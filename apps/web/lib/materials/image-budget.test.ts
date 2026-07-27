import assert from "node:assert/strict";
import { test } from "node:test";

import {
  IMAGE_BUDGET_WARNING_AT,
  imageBudgetNote,
  MAX_IMAGES_PER_FAMILY_PER_DAY,
} from "./image-budget";

test("states today's usage plainly, well under the warning line", () => {
  const note = imageBudgetNote(5);
  assert.match(note, /Images used today: 5 of 30\./u);
  assert.doesNotMatch(note, /close to today's limit/u);
});

test("adds a soft warning once the threshold is reached, with budget left", () => {
  const note = imageBudgetNote(IMAGE_BUDGET_WARNING_AT);
  assert.match(note, /Images used today: 24 of 30\./u);
  assert.match(note, /close to today's limit/u);
});

test("no warning once the budget is fully spent (nothing left to plan around)", () => {
  const note = imageBudgetNote(MAX_IMAGES_PER_FAMILY_PER_DAY);
  assert.match(note, /Images used today: 30 of 30\./u);
  assert.doesNotMatch(note, /close to today's limit/u);
});

test("never reports negative remaining budget past the cap", () => {
  const note = imageBudgetNote(MAX_IMAGES_PER_FAMILY_PER_DAY + 7);
  assert.match(note, new RegExp(`Images used today: ${MAX_IMAGES_PER_FAMILY_PER_DAY + 7} of 30\\.`, "u"));
});
