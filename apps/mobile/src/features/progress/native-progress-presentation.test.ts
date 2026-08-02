import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const cardSource = readFileSync(new URL("./subject-card.tsx", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("./map-model.ts", import.meta.url), "utf8");
const progressScreenSource = readFileSync(
  new URL("../../app/(tabs)/progress.tsx", import.meta.url),
  "utf8",
);
const kidSwitcherSource = readFileSync(new URL("./kid-switcher.tsx", import.meta.url), "utf8");

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

  it("keeps child selection accessible and every recovery state child-scoped", () => {
    assert.match(kidSwitcherSource, /minHeight: 44/u);
    assert.match(kidSwitcherSource, /accessibilityState=\{\{ selected: active \}\}/u);
    assert.match(kidSwitcherSource, /accessibilityLabel=\{`Show \$\{kid\.name\}'s progress`\}/u);
    assert.match(progressScreenSource, /Loading \$\{selectedChild\.name\}'s progress/u);
    assert.match(progressScreenSource, /progressLoadErrorCopy\(selectedChild\.name, view !== null\)/u);
    assert.match(progressScreenSource, /label="Try again"/u);
    assert.match(progressScreenSource, /progressDraft: draft/u);
  });
});
