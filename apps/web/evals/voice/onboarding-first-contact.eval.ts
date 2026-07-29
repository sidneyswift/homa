import { defineEval } from "eve/evals";

import { reportVoice } from "./report-voice";

/**
 * First contact, in the shape production actually runs it today. The
 * onboarding-mode preload was rolled back 2026-07-28 after it produced a
 * dead-end turn on the first real paid signup, so live onboarding reaches
 * the skill through `load_skill` on turn 0. That is what this drives.
 *
 * The voice ruling (`copy-voice-memorable`, 2026-07-29, gh#413) matters
 * most right here: this is the reply that decides whether a parent who has
 * not made up her mind about Homa yet comes back. It is also the moment
 * the retired voice was flattest, since a first message carries no data to
 * be specific about and the old rules answered that vacuum with warm
 * filler.
 */
export default defineEval({
  description: "A brand-new parent's first message loads onboarding and gets a reply worth answering.",
  async test(t) {
    const turns = [
      "hi, just signed up. not totally sure what you do honestly",
      "I have a 4 year old and a 6 year old. we've been doing this since september but it's pretty loose",
    ];

    for (const [i, text] of turns.entries()) {
      const before = t.events.length;
      await t.send(text);
      const tools = t.events
        .slice(before)
        .map((e) => (e as { type?: string; name?: string }).name)
        .filter((n): n is string => typeof n === "string");
      console.error(`\n╭─ turn ${i + 1} ── parent ─────────\n${text}`);
      console.error(`├─ tools ─────────\n${tools.length ? tools.join(", ") : "(none)"}`);
      console.error(`╰─ Homa ─────────\n${t.reply ?? "(no text: card-only turn?)"}\n`);
    }

    t.succeeded();
    // Gates the floors on the reply that first exposed them: this prompt
    // produced two em dashes on 2026-07-29, in a long conversational answer,
    // when the ban was sitting mid-list under the register guidance.
    reportVoice(t, "onboarding-first-contact (final turn)");
  },
});
