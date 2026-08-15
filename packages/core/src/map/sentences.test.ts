import assert from "node:assert/strict";
import { test } from "node:test";

import type { MapScores, SubjectScore } from "./scoring";
import { homaNote, subjectLine } from "./sentences";

function score(overrides: Partial<SubjectScore> = {}): SubjectScore {
  return {
    subjectId: "math",
    position: "ahead",
    monthsAhead: 8,
    frontierDeltaMonths: 8,
    beyondScale: false,
    highConfidence: true,
    observations: 2,
    strongestObservedStatement: "Counts ten objects accurately",
    strongestObservedMonths: 60,
    frontierStatement: null,
    frontierItemId: null,
    frontierDomain: null,
    exposureBased: false,
    ...overrides,
  };
}

test("report summaries translate scores into parent-facing next steps", () => {
  const line = subjectLine(score(), "Maya");

  assert.equal(line.badge, "A clear strength");
  assert.equal(line.numberLabel, "");
  assert.doesNotMatch(line.sentence, /ahead|\+8|months/i);

  const scores: MapScores = {
    subjects: [score(), score({ subjectId: "literacy", position: "on_track", monthsAhead: 0 })],
    strengthOrder: ["math", "literacy"],
    mappedCount: 2,
    totalSubjects: 16,
    observationCount: 4,
  };
  assert.doesNotMatch(homaNote(scores, "Maya"), /ahead|on track|\+\d|month/i);
});
