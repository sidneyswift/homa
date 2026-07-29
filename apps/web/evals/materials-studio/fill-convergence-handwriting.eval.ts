import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import {
  convergedAtTurn,
  printConvergenceTrace,
  runConvergenceScenario,
} from "./fill-convergence-support";

/**
 * A real revision saga, paraphrased onto Maya: a name-tracing handwriting
 * sheet whose letters and lines stayed too small to "fill the page" as
 * the parent kept asking, across a dozen rounds, never finalized. Real
 * wording and the family this is drawn from live only in
 * docs/homa-planning/plans/2026-07-29-materials-fill-convergence-evals.md.
 *
 * Turn 1 is the plain opening ask; turns 2+ are the real complaint
 * sequence, in order. The real parent also sent a reference photo of a
 * properly-filled tracing sheet on turn 2; this scenario carries only
 * her words (`t.sendFile` exists in this framework for a future version
 * that also replays the photo).
 *
 * Needs the sandbox for family-scoped tools:
 * `pnpm eval:sandbox materials-studio/fill-convergence-handwriting`.
 */
export default defineEval({
  description:
    "A name-tracing handwriting sheet for a young child scales its letters and lines to fill the page.",
  timeoutMs: 900_000,
  async test(t) {
    const turns = [
      "I want a handwriting sheet for Maya with her name to trace, and some of the letter-sound words she's working on.",
      "The letters need to fill the lines and take up the whole page, not just a small section.",
      "Can you redo it so it fills the entire page, bigger tracing letters.",
      "I want her to practice writing her name letter by letter, then her whole name at the bottom, with everything sized to fill the page.",
    ];

    const steps = await runConvergenceScenario(t, turns);
    t.loadedSkill("materials-studio");
    printConvergenceTrace("handwriting sheet (Maya)", steps);

    const turn = convergedAtTurn(steps);
    t.check(
      turn,
      satisfies(
        (value) => value !== null && (value as number) <= 3,
        "converged to a fill-clean create_printable result within 3 turns",
      ),
    );
  },
});
