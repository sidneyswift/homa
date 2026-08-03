import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { progressErrorPresentation } from "./progress-error-model";

const cardSource = readFileSync(new URL("./subject-card.tsx", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("./map-model.ts", import.meta.url), "utf8");
const progressScreenSource = readFileSync(
  new URL("../../app/(tabs)/progress.tsx", import.meta.url),
  "utf8",
);
const kidSwitcherSource = readFileSync(
  new URL("./kid-switcher.tsx", import.meta.url),
  "utf8",
);
const nextMoveCardSource = readFileSync(
  new URL("./progress-next-move-card.tsx", import.meta.url),
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
    assert.match(
      cardSource,
      /progressSubjectTakeaway\(subject, conflicts\)/u,
    );
    assert.match(cardSource, /accessibilityRole="button"/u);
    assert.match(cardSource, /accessibilityState=\{\{ expanded \}\}/u);
    assert.match(cardSource, /accessibilityLabel=/u);
    assert.match(cardSource, /accessibilityHint=/u);
    assert.match(cardSource, /expanded \? "Hide details" : "Show details"/u);
    assert.match(cardSource, /minHeight: 44/u);
    assert.match(cardSource, /summary\.sourceLabel/u);
    assert.match(cardSource, /summary\.derivationLabel/u);
    assert.match(cardSource, /summary\.dateLabel/u);
    assert.match(cardSource, /summary\.note/u);
    assert.match(cardSource, /accessibilityElementsHidden/u);
    assert.match(cardSource, /freshness\?\.kind === "quiet"/u);
    assert.match(cardSource, /color: colors\.textBody/u);
    assert.doesNotMatch(cardSource, /color: colors\.(?:sage|success)/u);
    assert.doesNotMatch(cardSource, /Please confirm/u);
  });

  it("renders complete no-data, loading, and retry states instead of a blank body", () => {
    assert.match(progressScreenSource, /familyLoading && children\.length === 0/u);
    assert.match(progressScreenSource, /Loading your family/u);
    assert.match(progressScreenSource, /progressAssessmentCta\(childName\)/u);
    assert.match(progressScreenSource, /view\.subjects\.length === 0/u);
    assert.match(progressScreenSource, /ProgressSkeleton/u);
    assert.match(progressScreenSource, /progressErrorPresentation\(failure, childName\)/u);
    assert.match(progressScreenSource, /progressDraftId/u);
    assert.match(progressScreenSource, /progressChildId/u);
    assert.match(progressScreenSource, /label="Tell Homa"/u);
    assert.doesNotMatch(progressScreenSource, /Tell Homa about \$\{childName\}/u);
  });

  it("mounts the model-backed next move only inside durable AI consent", () => {
    assert.match(
      progressScreenSource,
      /<AiConsentGate purpose="progress" embedded>[\s\S]*<ProgressNextMoveSection/u,
    );
    assert.match(
      progressScreenSource,
      /function ProgressNextMoveSection[\s\S]*useProgressNextMove\(view\)/u,
    );
    assert.doesNotMatch(
      progressScreenSource.slice(
        0,
        progressScreenSource.indexOf("function ProgressNextMoveSection"),
      ),
      /useProgressNextMove\(/u,
    );
  });

  it("gives each permanent failure a truthful recovery instead of retrying forever", () => {
    assert.deepEqual(
      progressErrorPresentation(
        { kind: "authentication", message: "expired", reason: "no-session" },
        "Maya",
      ),
      {
        title: "Sign in again",
        body: "Your session ended before Homa could load Maya’s progress.",
        action: "reauthenticate",
        actionLabel: "Sign in again",
      },
    );
    assert.equal(
      progressErrorPresentation(
        { kind: "scope", message: "disabled", reason: "disabled" },
        "Maya",
      ).action,
      "open-chat",
    );
    assert.equal(
      progressErrorPresentation(
        { kind: "scope", message: "missing", reason: "unknown-child" },
        "Maya",
      ).action,
      "refresh-family",
    );
    assert.equal(
      progressErrorPresentation(
        { kind: "invalid", message: "invalid", reason: "invalid-projection" },
        "Maya",
      ).actionLabel,
      "Check again",
    );
    assert.equal(
      progressErrorPresentation(
        { kind: "transient", message: "offline", reason: null },
        "Maya",
      ).actionLabel,
      "Try again",
    );
  });

  it("bounds navigation hierarchy while evidence text remains fully scalable", () => {
    assert.doesNotMatch(progressScreenSource, /maxFontSizeMultiplier/u);
    assert.doesNotMatch(kidSwitcherSource, /maxFontSizeMultiplier/u);
    assert.doesNotMatch(cardSource, /maxFontSizeMultiplier/u);
  });

  it("uses the contrast-safe selected-child treatment", () => {
    assert.match(kidSwitcherSource, /minHeight: 44/u);
    assert.match(kidSwitcherSource, /accessibilityState=\{\{ selected: active \}\}/u);
    assert.match(
      kidSwitcherSource,
      /accessibilityLabel=\{`Show \$\{kid\.name\}’s progress`\}/u,
    );
    assert.match(kidSwitcherSource, /backgroundColor: active \? colors\.action/u);
    assert.match(kidSwitcherSource, /color: active \? colors\.onBrand/u);
  });

  it("shows the conflict state once while preserving it in the accessible summary", () => {
    assert.match(cardSource, /const needsConfirm = subject\.state === "conflict"/u);
    assert.match(cardSource, /!needsConfirm \? \(/u);
    assert.match(cardSource, /takeaway\?\.stateLabel/u);
  });

  it("makes each next-move action and destination predictable", () => {
    assert.match(nextMoveCardSource, /"Adjust in Chat"/u);
    assert.match(nextMoveCardSource, /"Answer in Chat"/u);
    assert.match(
      nextMoveCardSource,
      /Nothing sends until you tap Send\./u,
    );
    assert.match(nextMoveCardSource, /Hides this suggestion until tomorrow\./u);
    assert.match(
      nextMoveCardSource,
      /accessibilityState=\{\{ disabled: dismissing, busy: dismissing \}\}/u,
    );
  });
});
