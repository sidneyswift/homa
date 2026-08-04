import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (file: string) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
const HUB = read("hub-step.tsx");
const HOMESCHOOL = read("homeschool-step.tsx");
const NEXT_KID = read("next-kid-step.tsx");
const PARENT = read("parent-step.tsx");
const TAG_INPUT = read("tag-input.tsx");
const SHELL = read("onboarding-shell.tsx");
const PRIMITIVES = readFileSync(
  new URL("../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("Quiet onboarding atom contract", () => {
  it("uses the shared atoms at every major onboarding seam", () => {
    assert.match(HUB, /QuietFrame/u);
    assert.match(HUB, /QuietAction/u);
    assert.match(HUB, /QuietFeedback/u);
    assert.match(HOMESCHOOL, /QuietFrame/u);
    assert.match(HOMESCHOOL, /QuietChoice/u);
    assert.match(HOMESCHOOL, /QuietField/u);
    assert.match(HOMESCHOOL, /QuietAction/u);
    assert.match(NEXT_KID, /QuietFrame/u);
    assert.match(NEXT_KID, /QuietAction/u);
    assert.match(PARENT, /QuietField[\s\S]*disabled=\{busy\}/u);
    assert.match(TAG_INPUT, /QuietField/u);
    assert.match(TAG_INPUT, /QuietTag/u);
    assert.match(SHELL, /quiet-onboarding__page/u);
  });

  it("does not retain retired onboarding identity or presentation seams", () => {
    for (const source of [HUB, HOMESCHOOL, NEXT_KID, PARENT, TAG_INPUT, SHELL]) {
      assert.doesNotMatch(source, /Doodle/u);
      assert.doesNotMatch(source, /font-display\s+text-lg/u);
      assert.doesNotMatch(source, /(?:bg-card|border-border|text-(?:body|strong|muted|subtle))/u);
      assert.doesNotMatch(source, /sending\.\.\./u);
    }
    assert.doesNotMatch(TAG_INPUT, /homa-(?:visual-coral|brand-text)[^\n]*(?:selected|pressed)/iu);
    assert.doesNotMatch(HOMESCHOOL, /homa-(?:visual-coral|brand-text)[^\n]*(?:selected|pressed)/iu);
  });

  it("keeps tags touch-sized and resilient across motion and contrast modes", () => {
    assert.match(PRIMITIVES, /\.quiet-tag\s*\{/u);
    assert.match(PRIMITIVES, /\.quiet-tag:focus-visible/u);
    assert.match(PRIMITIVES, /@media \(forced-colors: active\)[\s\S]*\.quiet-tag/u);
    assert.match(PRIMITIVES, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.quiet-tag/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__style-choice \.quiet-choice__options/u);
  });
});
