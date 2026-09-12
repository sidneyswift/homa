import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { ChecklistState } from "./checklist-state";
import { ONBOARDING_STAGE_MARKDOWN } from "./onboarding-skill-body.generated";
import { renderOnboardingStageGuidance, selectOnboardingGuidance } from "./stage-guidance";
import { EMPTY_ONBOARDING_RECORD } from "./state";

function child(overrides: Partial<ChecklistState> = {}): ChecklistState {
  return { childId: "a", childName: "Alex", ageMonths: 72, scoredAgeRange: true,
    answered: 2, skipped: 0, remaining: 4, minutesLeft: 2, complete: false,
    reported: false, growingEdges: [], ...overrides };
}

test("every stage ships the exact filesystem reference", () => {
  for (const [name, markdown] of Object.entries(ONBOARDING_STAGE_MARKDOWN)) {
    assert.equal(markdown, readFileSync(new URL(`../../agent/skills/onboarding/references/${name}.md`, import.meta.url), "utf8"));
  }
});

test("setup excludes unrelated report/moment procedures but allows the next stage", () => {
  const stages = selectOnboardingGuidance({ record: null, children: [] });
  assert.deepEqual(stages, ["family-setup", "questions"]);
  assert.ok(!renderOnboardingStageGuidance({ record: null, children: [] }).includes("## Interrupting with a moment"));
});

test("a newly saved roster retains app-owned-card rules", () => {
  const stages = selectOnboardingGuidance({ record: null, children: [child({ answered: 0 })] });
  assert.ok(stages.includes("family-setup"));
  assert.ok(stages.includes("questions"));
});

test("a completed question set can reach report and rehearsal this turn", () => {
  const stages = selectOnboardingGuidance({ record: null, children: [child({ complete: true, remaining: 0 })] });
  assert.ok(stages.includes("report-and-handoff"));
  assert.ok(stages.includes("rehearsal"));
});

test("an unreported sibling does not pull a focused reported child back into questions", () => {
  assert.deepEqual(selectOnboardingGuidance({ record: null, children: [child({ reported: true }), child({ childId: "b" })] }, "a"), ["report-and-handoff", "rehearsal", "moments"]);
});

test("a stale or foreign focus cannot hide an unfinished child's questions", () => {
  const stages = selectOnboardingGuidance({ record: null, children: [child(), child({ childId: "b", reported: true })] }, "foreign");
  assert.ok(stages.includes("questions"));
});

test("missing state retains every procedure and done state adds none", () => {
  assert.equal(selectOnboardingGuidance(null).length, Object.keys(ONBOARDING_STAGE_MARKDOWN).length);
  assert.equal(renderOnboardingStageGuidance({ record: { ...EMPTY_ONBOARDING_RECORD, state: "done" }, children: [child()] }), "");
});

test("children outside question ages can reach an honest handoff", () => {
  assert.deepEqual(selectOnboardingGuidance({ record: null, children: [child({ scoredAgeRange: false })] }), ["report-and-handoff", "rehearsal", "moments"]);
});
