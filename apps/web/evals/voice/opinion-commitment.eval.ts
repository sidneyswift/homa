import { defineEval } from "eve/evals";

import { reportVoice } from "./report-voice";

/**
 * Voice ruling `copy-voice-memorable` (2026-07-29, gh#413): when the parent
 * asks what to do, Homa commits. "It depends" is a last resort, never an
 * opening move, and a recommendation she has to excavate from four hedges is
 * one that was never really made.
 *
 * Guards the half of the ruling most likely to decay first: hedging is the
 * safe-feeling default a model slides back into, and the old voice stack
 * (offers-never-commands plus one-gentle-suggestion-per-reply) actively
 * rewarded it.
 */
export default defineEval({
  description: "A direct 'what would you do' gets a committed recommendation, not a hedge.",
  async test(t) {
    await t.send(
      "Finn keeps melting down during math. Do I push through the workbook or drop it for a while? Just tell me what you'd do.",
    );
    t.succeeded();
    reportVoice(t, "opinion-commitment");
  },
});
