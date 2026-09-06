import assert from "node:assert/strict";
import test from "node:test";
import { materialReviewAdvisoryNotes } from "./review-advisory-notes";

test("blocking review plus both advisory kinds preserves hidden disposition and all page findings", () => {
  const note = materialReviewAdvisoryNotes({ reviewPassed: false, advisoryIssues: ["Page 3: small title"], checklistAdvisory: ["Page 1: guide spacing"] });
  assert.match(note, /Page 3: small title/);
  assert.match(note, /Page 1: guide spacing/);
  assert.match(note, /remains hidden/);
  assert.doesNotMatch(note, /available to her|IS shown|do not rebuild until she says yes/);
});

test("advisories on a passing draft leave the parent's revision choice intact", () => {
  const note = materialReviewAdvisoryNotes({ reviewPassed: true, advisoryIssues: [], checklistAdvisory: ["Page 2: tight margins"] });
  assert.match(note, /available to her/);
  assert.match(note, /do not rebuild until she says yes/);
  assert.match(note, /Page 2: tight margins/);
  assert.doesNotMatch(note, /remains hidden/);
});

test("neither review outcome invents an advisory when there are no findings", () => {
  for (const reviewPassed of [false, true]) {
    assert.equal(materialReviewAdvisoryNotes({ reviewPassed, advisoryIssues: [], checklistAdvisory: [] }), "");
  }
});
