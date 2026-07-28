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

/** Null only if the generated mirror was emptied, which the byte-exact
 *  check catches before a deploy; the null branch keeps the pre-preload
 *  contract alive rather than costing a session its onboarding arc. */
const preloadedSkill: string | null =
  ONBOARDING_SKILL_MARKDOWN.trim().length > 0 ? ONBOARDING_SKILL_MARKDOWN : null;

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const attributes = ctx.session.auth.current
        ?.attributes as OnboardingModeAttributes;
      if (preloadedSkill === null && isOnboardingModeSession(attributes)) {
        // Logged per affected turn, not once per cold start, so the count
        // in runtime logs is the number of parents who actually paid for
        // it rather than the number of instances that booted.
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
