import assert from "node:assert/strict";
import test from "node:test";

import { suppressInTurnGeneration } from "./generation-gate";

// The gate exists so a web onboarding session cannot reach the in-turn
// generation tools; every other session keeps them exactly as before.

test("a web onboarding session suppresses in-turn generation", () => {
  assert.equal(
    suppressInTurnGeneration({ onboardingActive: "true" }),
    true,
  );
  assert.equal(
    suppressInTurnGeneration({ onboardingActive: "true", channel: "web" }),
    true,
  );
});

test("a finished family's web session keeps the tools", () => {
  assert.equal(suppressInTurnGeneration({}), false);
  assert.equal(suppressInTurnGeneration(undefined), false);
  assert.equal(
    suppressInTurnGeneration({ onboardingActive: "false" }),
    false,
  );
});

test("the agent-job build session always keeps create_printable", () => {
  assert.equal(
    suppressInTurnGeneration({
      onboardingActive: "true",
      channel: "agent-job",
    }),
    false,
  );
});

test("sms, email, dispatch, and subject-lesson sessions are untouched", () => {
  for (const channel of ["sms", "email", "dispatch", "subject_lesson"]) {
    assert.equal(
      suppressInTurnGeneration({ onboardingActive: "true", channel }),
      false,
    );
  }
});
