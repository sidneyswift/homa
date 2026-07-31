import { defineDynamic, defineInstructions } from "eve/instructions";

import {
  composeOnboardingModeMarkdown,
  isOnboardingModeSession,
  type OnboardingModeAttributes,
} from "../../lib/onboarding/onboarding-mode";
import { ONBOARDING_SKILL_MARKDOWN } from "../../lib/onboarding/onboarding-skill-body.generated";

/**
 * Chat-first onboarding, the routing layer's eve wiring
 * (plans/2026-07-21-chat-first-onboarding.md §2.2).
 *
 * The mode text, the routing predicate, and the reasons the skill body
 * is inlined here rather than behind load_skill all live in
 * lib/onboarding/onboarding-mode.ts, where plain node can import them
 * for the routing fixtures. This file owns getting SKILL.md to the
 * composer without the sandbox: eve's load_skill reads through the
 * sandbox session, and that provisioning cost is part of what the
 * preload removes.
 *
 * The body arrives as source, from the generated mirror of SKILL.md that
 * scripts/build-onboarding-skill.mts writes. It used to arrive from a
 * readFileSync of the source tree, which resolved in next dev, eve dev
 * and tsx and threw in production, because the deployed eve function is
 * a nitro bundle with no source tree in it: every production onboarding
 * session from 2026-07-24 silently paid the load_skill round trip the
 * preload exists to remove (issue #246). eve 0.19's build cannot inline
 * the markdown itself, so the text travels as code and the mirror stays
 * honest through the byte-exact check in
 * lib/onboarding/onboarding-mode.test.ts.
 */

/**
 * ROLLED BACK 2026-07-28, then re-landed behind a harness guard and the
 * two-turn sandbox eval in issue #315 on 2026-07-31.
 *
 * The #246 fix made this preload actually reach the deployed bundle for
 * the first time. The first real paid signup after it hit a dead end:
 * the parent filled the family card, and the turn that should have
 * reacted and put up the next card made ZERO tool calls and delivered
 * nothing. She was left looking at her own answer.
 *
 * Sessions from the same hour tell the story cleanly. Where the skill
 * still arrived via load_skill, that turn worked:
 *
 *   turn_0: load_skill, ask_for_details
 *   turn_1: ask_for_details            <- advances
 *
 * On the preloaded path:
 *
 *   turn_0: ask_for_details
 *   turn_1: (nothing)                  <- dead end
 *
 * Every real onboarding run on 2026-07-22 through 07-24 shows turn_1
 * calling save_family_basics and/or ask_for_details. Not one shows an
 * empty turn. The preload is the only thing that changed.
 *
 * Why the load_skill call was load-bearing, most likely: the tool result
 * from ask_for_details tells the model to end that turn with exactly
 * <eve-empty-delivery/>, and the guard against repeating it on the next
 * turn is prose in that same result. A mandatory tool call on the next
 * turn broke the pattern; without one, the model's most recent output is
 * the sentinel and it appears to reach for it again. That is a prose
 * guard on a judgment with exactly one correct answer, which is the
 * failure class docs/homa-planning/models-judge-code-verifies.md is
 * about, so the real repair is a deterministic no-silent-turn guard plus
 * an eval that drives this exact two-turn sequence.
 *
 * Latency (#246): the "4 seconds" this rollback was estimated to cost
 * turned out to be too pessimistic about load_skill itself and too
 * optimistic about everything else. Measured against production
 * (gh#404, 2026-07-31): 97 real onboarding load_skill calls over 14
 * days average 0.28s (median 0.09s, worst 3.77s), nowhere near 4s. But
 * roughly 1 in 17 to 20 onboarding turns pays a real 20 to 85 second
 * delay that load_skill's own timing rules out as the cause; the
 * mechanism is unconfirmed and tracked separately as gh#485. Either
 * way, a real but small guaranteed cost beats a turn that stops dead
 * after the parent has already been charged. Re-land the preload only
 * behind that guard and that eval, never on prose alone.
 */
const PRELOAD_ROLLED_BACK_PENDING_SILENT_TURN_GUARD = false;

/**
 * The generated mirror really being empty, which is a build mistake, as
 * opposed to the rollback above, which is a decision. Walk 002
 * (2026-07-29) spent real time chasing "run pnpm build:onboarding-skill
 * and redeploy" on a machine whose generated file was a correct 28KB:
 * the preload was off because the constant above says so, and the log
 * line named the one cause that was not firing. A diagnostic that can
 * report two causes has to know which one it saw.
 */
const skillBodyMissing = ONBOARDING_SKILL_MARKDOWN.trim().length === 0;

const preloadedSkill: string | null =
  PRELOAD_ROLLED_BACK_PENDING_SILENT_TURN_GUARD || skillBodyMissing
    ? null
    : ONBOARDING_SKILL_MARKDOWN;

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const attributes = ctx.session.auth.current
        ?.attributes as OnboardingModeAttributes;
      if (skillBodyMissing && isOnboardingModeSession(attributes)) {
        // Logged per affected turn, not once per cold start, so the count
        // in runtime logs is the number of parents who actually paid for
        // it rather than the number of instances that booted.
        //
        // Only for the build mistake. While the rollback constant above
        // is the reason the preload is off, that is a deliberate state
        // with its own long explanation in source, and shouting it once
        // per onboarding turn in production logged noise under a
        // remediation that does not apply (walk 002, 2026-07-29).
        console.error(
          "onboarding-mode: the inlined onboarding skill body is empty, so this onboarding turn falls back to load_skill and the parent waits an extra model round trip. Run pnpm build:onboarding-skill and redeploy (issue #246).",
        );
      }
      const markdown = composeOnboardingModeMarkdown(
        attributes,
        preloadedSkill,
      );
      return markdown ? defineInstructions({ markdown }) : null;
    },
  },
});
