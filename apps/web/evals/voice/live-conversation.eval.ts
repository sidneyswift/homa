import { defineEval } from "eve/evals";

import { reportVoice } from "./report-voice";

/**
 * A real session rather than a single prompt: a parent vents, asks for
 * something, corrects Homa, and then asks the question she actually came
 * for. Voice is a property of a conversation, and the retired stack's
 * failure mode (every reply cushioned, every suggestion gentle, every
 * opinion hedged) only becomes obvious across several turns in a row.
 *
 * Prints every turn so a human can read the arc. The floors run on the
 * last reply, and the correction turn doubles as a live check that a
 * bolder register still treats the parent's correction as a floor rather
 * than arguing with her (instructions.md, "What you know each turn").
 */
export default defineEval({
  description: "A four-turn session reads like one person talking, and the correction lands.",
  async test(t) {
    const turns = [
      "Honestly today was a disaster. Nobody wanted to do anything and I ended up crying in the pantry.",
      "Maya's the one I'm worried about. Can you make her something for letter sounds?",
      "She can already do letter sounds fine, that's not it. She just won't sit down for anything.",
      "Am I actually screwing this up? Like should she be in real school",
    ];

    for (const [i, text] of turns.entries()) {
      await t.send(text);
      console.error(`\n╭─ turn ${i + 1} ── parent ─────────\n${text}`);
      console.error(`╰─ Homa ─────────\n${t.reply ?? "(no reply)"}\n`);
    }

    t.succeeded();
    reportVoice(t, "live-conversation (final turn)");
  },
});
