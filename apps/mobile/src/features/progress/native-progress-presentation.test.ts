import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const cardSource = readFileSync(new URL("./subject-card.tsx", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("./map-model.ts", import.meta.url), "utf8");
const progressScreenSource = readFileSync(
  new URL("../../app/(tabs)/progress.tsx", import.meta.url),
  "utf8",
);

describe("native Progress child-safe presentation contract", () => {
  it("keeps every internal score position out of the collapsed subject card", () => {
    const collapsedPath = `${cardSource}\n${modelSource}\n${progressScreenSource}`;

    assert.doesNotMatch(collapsedPath, /subjectLine|numberLabel|monthsAhead/u);
    assert.doesNotMatch(collapsedPath, /\bAhead\b|\bOn track\b|\+\d+\s*mo\b/u);
    assert.doesNotMatch(cardSource, /\bscores\b/u);
  });

  it("leads with evidence and exposes the expandable state to assistive technology", () => {
    assert.match(cardSource, /progressSubjectSummary\(subject, timeZone, conflicts\)/u);
    assert.match(cardSource, /accessibilityRole="button"/u);
    assert.match(cardSource, /accessibilityState=\{\{ expanded \}\}/u);
    assert.match(cardSource, /accessibilityLabel=/u);
    assert.doesNotMatch(cardSource, /Please confirm/u);
  });
});
