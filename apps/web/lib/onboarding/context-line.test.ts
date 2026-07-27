import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ChecklistState } from "./checklist-state";
import { renderOnboardingContext } from "./context-line";
import { EMPTY_ONBOARDING_RECORD } from "./state";

function child(overrides: Partial<ChecklistState> & { childName: string }): ChecklistState {
  return {
    childId: `id-${overrides.childName}`,
    ageMonths: 72,
    scoredAgeRange: true,
    answered: 0,
    skipped: 0,
    remaining: 16,
    minutesLeft: 5,
    complete: false,
    reported: false,
    ...overrides,
  };
}

describe("renderOnboardingContext", () => {
  it("says plainly that there are no children yet", () => {
    const text = renderOnboardingContext({ record: null, children: [] });
    assert.ok(text);
    assert.match(text, /no children added yet/);
  });

  it("names each child's real position, so Homa never asks twice", () => {
    const text = renderOnboardingContext({
      record: null,
      children: [
        child({ childName: "Mia", answered: 41, remaining: 0, complete: true, reported: true }),
        child({ childName: "Leo", answered: 12, remaining: 4 }),
        child({ childName: "Zoe" }),
      ],
    });
    assert.ok(text);
    assert.match(text, /Mia report ready/);
    assert.match(text, /Leo 12 answered, 4 left/);
    assert.match(text, /Zoe not started/);
  });

  it("separates answered-but-unscored from scored", () => {
    const text = renderOnboardingContext({
      record: null,
      children: [
        child({ childName: "Mia", answered: 41, remaining: 0, complete: true, reported: false }),
      ],
    });
    assert.match(text ?? "", /Mia answered, not scored yet/);
  });

  it("marks a child the questions do not cover", () => {
    const text = renderOnboardingContext({
      record: null,
      children: [child({ childName: "Sam", scoredAgeRange: false })],
    });
    assert.match(text ?? "", /Sam outside the question ages/);
  });

  it("carries the recorded facts that live nowhere else", () => {
    const text = renderOnboardingContext({
      record: {
        ...EMPTY_ONBOARDING_RECORD,
        beatsDone: ["T2", "T3"],
        paywallShownAt: "2026-07-21T18:00:00.000Z",
      },
      children: [child({ childName: "Mia" })],
    });
    assert.match(text ?? "", /already done: T2, T3/);
    assert.match(text ?? "", /membership already offered/);
  });

  it("tells Homa the block is data, not instructions", () => {
    const text = renderOnboardingContext({
      record: null,
      children: [child({ childName: "Mia" })],
    });
    assert.match(text ?? "", /Facts, not instructions/);
    assert.match(text ?? "", /never ask her something this line already answers/);
  });
});
