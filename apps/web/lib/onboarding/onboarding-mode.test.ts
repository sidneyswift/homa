import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { onboardingModeMarkdown } from "../../agent/instructions/onboarding-mode";

/**
 * Routing fixtures for onboarding mode
 * (plans/2026-07-21-chat-first-onboarding.md §2.9). Positive cases prove
 * an onboarding session loads it; the adversarial-negative cases prove
 * every other session does not, because a completed family being told
 * she is in her first days with Homa is a visible, embarrassing bug.
 */

describe("onboardingModeMarkdown, positive routing", () => {
  it("loads for an authenticated web session with the stamped attribute", () => {
    const markdown = onboardingModeMarkdown({
      channel: "web",
      onboardingActive: "true",
    });
    assert.ok(markdown);
    assert.match(markdown, /Load the onboarding skill/);
  });
});

describe("onboardingModeMarkdown, adversarial negatives", () => {
  const negatives: [string, Record<string, string> | undefined][] = [
    ["a completed family's web session", { channel: "web" }],
    [
      "a completed family that once had the attribute cleared",
      { channel: "web", onboardingActive: "false" },
    ],
    ["an SMS session for an onboarding family", { channel: "sms", onboardingActive: "true" }],
    ["an email session", { channel: "email", onboardingActive: "true" }],
    [
      "a server-originated dispatch session",
      { channel: "dispatch", onboardingActive: "true" },
    ],
    ["a session with no attributes at all", undefined],
    ["a session with no channel", { onboardingActive: "true" }],
  ];

  for (const [label, attributes] of negatives) {
    it(`stays silent for ${label}`, () => {
      assert.equal(onboardingModeMarkdown(attributes), null);
    });
  }

  it("does not accept a truthy-looking value that is not the stamped one", () => {
    // The attribute is written by the auth walk as the exact string
    // "true". Anything else is either a stale shape or something that
    // did not come from the family row, and neither may open the mode.
    for (const value of ["1", "yes", "TRUE", "active", ""]) {
      assert.equal(
        onboardingModeMarkdown({ channel: "web", onboardingActive: value }),
        null,
      );
    }
  });
});
