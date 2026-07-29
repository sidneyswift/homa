import { defineEval } from "eve/evals";

import { reportVoice } from "./report-voice";

/**
 * Voice ruling `copy-voice-memorable` (2026-07-29, gh#413): say the real
 * thing, then be kind about it. Charm over cruelty, never sugarcoating over
 * charm.
 *
 * The parent here has already bought something that is wrong for her child,
 * which is the exact moment the retired voice stack produced mush: "reassure
 * before you inform" plus "offers, never commands" turned a useful warning
 * into an interesting-choice non-answer. Bluntness about a curriculum is now
 * explicitly encouraged; bluntness about the child never is, which is why
 * the floors run on this reply too.
 */
export default defineEval({
  description: "A curriculum that is wrong for the child gets said plainly, not softened into nothing.",
  async test(t) {
    await t.send(
      "I just bought the Level 2 reading program for Story. It says ages 5 to 7 on the box. Think it'll work?",
    );
    t.succeeded();
    reportVoice(t, "hard-truth");
  },
});
