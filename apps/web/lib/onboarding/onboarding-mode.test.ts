import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { composeOnboardingModeMarkdown } from "./onboarding-mode";
import { ONBOARDING_SKILL_MARKDOWN } from "./onboarding-skill-body.generated";

/**
 * Routing fixtures for onboarding mode
 * (plans/2026-07-21-chat-first-onboarding.md §2.9). Positive cases prove
 * an onboarding session loads it; the adversarial-negative cases prove
 * every other session does not, because a completed family being told
 * she is in her first days with Homa is a visible, embarrassing bug.
 *
 * The raw skill is the real file, so these fixtures exercise the same
 * composition the deployed function ships.
 */

const rawSkill = readFileSync(
  new URL("../../agent/skills/onboarding/SKILL.md", import.meta.url),
  "utf8",
);

describe("the generated skill mirror the deployed bundle preloads", () => {
  it("is byte for byte the SKILL.md a human edits", () => {
    // The deployed eve function is a nitro bundle with no source tree, so
    // the body has to travel as code (issue #246). That makes staleness
    // the new silent failure: an edited SKILL.md with an unregenerated
    // mirror would preload yesterday's onboarding arc and say nothing.
    // This is the check that fails instead.
    assert.equal(
      ONBOARDING_SKILL_MARKDOWN,
      rawSkill,
      "onboarding-skill-body.generated.ts is stale. Run: pnpm build:onboarding-skill",
    );
  });

  it("is never empty, because an empty body silently costs a load_skill round trip", () => {
    assert.ok(ONBOARDING_SKILL_MARKDOWN.trim().length > 0);
  });
});

describe("composeOnboardingModeMarkdown, positive routing", () => {
  it("loads for an authenticated web session with the stamped attribute", () => {
    const markdown = composeOnboardingModeMarkdown(
      { channel: "web", onboardingActive: "true" },
      rawSkill,
    );
    assert.ok(markdown);
    assert.match(markdown, /first days with Homa/);
  });

  it("loads for the explicit sandboxed onboarding eval session", () => {
    const markdown = composeOnboardingModeMarkdown(
      {
        channel: "materials-lab",
        onboardingActive: "true",
        evalFamilyFixture: "true",
        evalOnboardingMode: "true",
      },
      rawSkill,
    );
    assert.ok(markdown);
    assert.match(markdown, /first days with Homa/);
  });

  it("carries the whole onboarding skill body, so no turn spends a model round trip on load_skill", () => {
    const markdown = composeOnboardingModeMarkdown(
      { channel: "web", onboardingActive: "true" },
      rawSkill,
    );
    assert.ok(markdown);
    // The preloaded header and a sentence that only exists in the skill
    // body itself, so a regression back to the load_skill line fails
    // loudly here rather than re-adding a hidden model round trip.
    assert.match(markdown, /never call load_skill for "onboarding"/);
    assert.match(markdown, /She made an account a minute ago/);
    // The frontmatter stays out: it is a routing hint for load_skill,
    // not something to spend prompt tokens on every turn.
    assert.doesNotMatch(markdown, /^---/m);
    assert.doesNotMatch(markdown, /Use when the session belongs to a family/);
  });

  it("keeps one voice-rule copy on each independently loadable surface", () => {
    // The speak-to-her rule was consolidated from four copies to two
    // (2026-07-25): the mode markdown is the pre-skill floor on web,
    // and the skill body's What-not-to-do bullet is the only carrier
    // when load_skill pulls the body into an SMS, email, or dispatch
    // session where the mode markdown is deliberately absent. Deleting
    // either remaining copy must fail here, loudly.
    const markdown = composeOnboardingModeMarkdown(
      { channel: "web", onboardingActive: "true" },
      rawSkill,
    );
    assert.ok(markdown);
    assert.match(markdown, /She is "you"/);
    assert.match(rawSkill, /third person reach a reply/);
    assert.match(rawSkill, /A name and a birthday carry no pronouns/);
  });
});

describe("composeOnboardingModeMarkdown, adversarial negatives", () => {
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
    [
      "an ordinary materials-lab fixture session",
      {
        channel: "materials-lab",
        onboardingActive: "true",
        evalFamilyFixture: "true",
      },
    ],
    [
      "an untrusted materials-lab onboarding marker",
      {
        channel: "materials-lab",
        onboardingActive: "true",
        evalOnboardingMode: "true",
      },
    ],
  ];

  for (const [label, attributes] of negatives) {
    it(`stays silent for ${label}`, () => {
      assert.equal(composeOnboardingModeMarkdown(attributes, rawSkill), null);
    });
  }

  it("does not accept a truthy-looking value that is not the stamped one", () => {
    // The attribute is written by the auth walk as the exact string
    // "true". Anything else is either a stale shape or something that
    // did not come from the family row, and neither may open the mode.
    for (const value of ["1", "yes", "TRUE", "active", ""]) {
      assert.equal(
        composeOnboardingModeMarkdown(
          { channel: "web", onboardingActive: value },
          rawSkill,
        ),
        null,
      );
    }
  });
});

describe("the preload re-land after the 2026-07-28 incident", () => {
  const source = readFileSync(
    new URL("../../agent/instructions/onboarding-mode.ts", import.meta.url),
    "utf8",
  );

  it("preloads only after the deterministic guard and two-turn eval exist", () => {
    // The first real paid signup dead-ended on the preloaded path: the
    // turn after the family card made zero tool calls and delivered
    // nothing. Sessions that still reached the skill via load_skill
    // advanced correctly in the same hour. The preload is safe to re-land
    // only because the harness now retries sentinel-only silence without an
    // action, and the behavioral eval drives the exact card then answer path.
    assert.match(
      source,
      /const PRELOAD_ROLLED_BACK_PENDING_SILENT_TURN_GUARD = false;/u,
    );
    const guard = readFileSync(
      new URL(
        "../../../../scripts/eve-empty-delivery-guard-check.mjs",
        import.meta.url,
      ),
      "utf8",
    );
    const evalSource = readFileSync(
      new URL(
        "../../evals/onboarding/card-answer-never-silent.eval.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(guard, /isUnbackedEmptyDelivery/u);
    assert.match(evalSource, /the turn after the details card completed/u);
  });

  it("keeps the generated mirror wired up for the re-land", () => {
    // The rollback was one constant, not a revert: the mirror, its build
    // script, and the byte-exact check above stayed live through the re-land.
    assert.match(source, /ONBOARDING_SKILL_MARKDOWN/u);
  });
});
