import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const CHECKLIST = readFileSync(new URL("./checklist-step.tsx", import.meta.url), "utf8");
const DEEP_DIVE = readFileSync(new URL("./deep-dive-step.tsx", import.meta.url), "utf8");
const PRIMITIVES = readFileSync(
  new URL("../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("Quiet onboarding question surfaces", () => {
  it("uses canonical atoms for answers, status, recovery, and exit actions", () => {
    assert.match(CHECKLIST, /QuietAction/u);
    assert.match(CHECKLIST, /QuietFrame/u);
    assert.match(CHECKLIST, /QuietFeedback/u);
    assert.match(CHECKLIST, /QuietStatus/u);
    assert.match(DEEP_DIVE, /QuietAction/u);
    assert.match(DEEP_DIVE, /QuietChoice/u);
    assert.match(DEEP_DIVE, /QuietFrame/u);
    assert.match(DEEP_DIVE, /QuietFeedback/u);
    assert.match(DEEP_DIVE, /QuietStatus/u);
    for (const source of [CHECKLIST, DEEP_DIVE]) {
      assert.doesNotMatch(source, /font-(?:mono|hand)|rounded-(?:lg|xl|2xl|3xl|full)/u);
      assert.doesNotMatch(source, /(?:bg-card|border-border|text-(?:body|strong|muted|subtle))/u);
      assert.doesNotMatch(source, /<button/u);
    }
  });

  it("keeps adaptive question geometry and accessibility behavior in the shared adapter", () => {
    assert.match(PRIMITIVES, /\.quiet-onboarding__question-card\s*\{[\s\S]*display:\s*flex/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__answer-grid\s*\{/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__deep-dive \.quiet-onboarding__answer-grid/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__progress-fill\s*\{/u);
    assert.match(PRIMITIVES, /\.quiet-action:focus-visible/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__progress-fill\s*\{\s*transition:/u);
  });
});
