import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const FAMILY = readFileSync(new URL("./family-step.tsx", import.meta.url), "utf8");
const KIDS = readFileSync(new URL("./kids-step.tsx", import.meta.url), "utf8");
const PRIMITIVES = readFileSync(
  new URL("../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("Quiet onboarding family and kids surfaces", () => {
  it("routes family and child setup through the shared atoms", () => {
    for (const source of [FAMILY, KIDS]) {
      assert.match(source, /QuietField/u);
      assert.match(source, /QuietFrame/u);
      assert.match(source, /QuietAction/u);
      assert.match(source, /QuietFeedback/u);
      assert.doesNotMatch(source, /inputClass/u);
      assert.doesNotMatch(source, /font-(?:mono|hand)|rounded-(?:lg|xl|2xl|3xl|full)/u);
      assert.doesNotMatch(source, /(?:bg-card|border-border|text-(?:body|strong|muted|subtle))/u);
    }
    assert.match(KIDS, /QuietStatus/u);
    assert.match(KIDS, /quiet-onboarding__birthday-grid/u);
    assert.match(FAMILY, /quiet-onboarding__file-input/u);
  });

  it("keeps narrow birthday controls, file affordances, and focus states canonical", () => {
    assert.match(PRIMITIVES, /\.quiet-onboarding__birthday-grid\s*\{/u);
    assert.match(PRIMITIVES, /grid-template-columns:\s*minmax\(0, 1fr\)/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__file-input::file-selector-button/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__saved-kid\s*\{/u);
    assert.match(PRIMITIVES, /\.quiet-field__control:focus-visible/u);
    assert.match(PRIMITIVES, /\.quiet-action:focus-visible/u);
  });
});
