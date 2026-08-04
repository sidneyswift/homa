import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const MAP_FLOW = readFileSync(new URL("./map-flow.tsx", import.meta.url), "utf8");
const SOURCES = [
  readFileSync(new URL("./extras-step.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./preparing-step.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./scoring-step.tsx", import.meta.url), "utf8"),
];
const PRIMITIVES = readFileSync(
  new URL("../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("Quiet onboarding loading surfaces", () => {
  it("uses shared frames and actions without retired aliases", () => {
    assert.ok(SOURCES.every((source) => source.includes("QuietFrame")));
    assert.ok(SOURCES.some((source) => source.includes("QuietAction")));
    assert.ok(SOURCES[0].includes("quiet-onboarding__completion-note"));
    assert.ok(SOURCES.slice(1).every((source) => source.includes("quiet-onboarding__progress")));
    assert.ok(SOURCES.slice(1).every((source) => source.includes("quiet-onboarding__signature")));
    for (const source of SOURCES) {
      assert.doesNotMatch(source, /font-(?:mono|hand)|rounded-(?:lg|xl|2xl|3xl|full)/u);
      assert.doesNotMatch(source, /(?:bg-card|border-border|text-(?:body|strong|muted|subtle))/u);
    }
  });

  it("keeps canonical motion, focus, and action styling", () => {
    assert.match(PRIMITIVES, /\.quiet-onboarding__progress-line/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__progress-mark--done/u);
    assert.match(PRIMITIVES, /\.quiet-action:focus-visible/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding-surface \.flow-step-in \{\s*animation:/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding-surface \.flow-step-in \{\s*animation: none;/u);
    assert.match(PRIMITIVES, /data-flow-phase="bootstrap-error"/u);
    assert.match(MAP_FLOW, /data-flow-phase=\{phase\}/u);
  });

  it("keeps the bootstrap fallback on the quiet atom path", () => {
    assert.match(MAP_FLOW, /QuietFrame/u);
    assert.match(MAP_FLOW, /QuietFeedback/u);
    assert.match(MAP_FLOW, /QuietAction/u);
    assert.match(MAP_FLOW, /quiet-onboarding__loading-skeleton/u);
    assert.match(MAP_FLOW, /quiet-onboarding__error-action/u);
    assert.doesNotMatch(MAP_FLOW, /rounded-\[var\(--homa-radius-card\)\]/u);
    assert.doesNotMatch(MAP_FLOW, /animate-pulse/u);
    assert.match(PRIMITIVES, /@keyframes quiet-loading-sheen/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__bootstrap/u);
    assert.match(PRIMITIVES, /\.quiet-onboarding__loading-skeleton-line \{ animation: none; \}/u);
  });
});
