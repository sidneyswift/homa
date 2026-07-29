import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import {
  convergedAtTurn,
  printConvergenceTrace,
  runConvergenceScenario,
} from "./fill-convergence-support";

/**
 * A real revision saga, paraphrased onto Story: a cut-and-paste unit
 * study packet whose glue boxes and pictures stayed too small for small
 * hands, page after page, across four days. The real parent named the
 * fix herself without knowing it: make the existing pieces bigger, don't
 * add more little things. That is exactly what the 2026-07-29
 * worksheet-scale-to-fill ruling made the binding instruction. Real
 * wording and the family this is drawn from live only in
 * docs/homa-planning/plans/2026-07-29-materials-fill-convergence-evals.md.
 *
 * Turn 1 is the plain opening ask; turns 2+ are the real complaint
 * sequence, in order.
 *
 * Needs the sandbox for family-scoped tools:
 * `pnpm eval:sandbox materials-studio/fill-convergence-cutout-packet`.
 */
export default defineEval({
  description:
    "A cut-and-paste unit-study packet for a young child scales its pieces to fit, instead of leaving them small in a half-empty page.",
  // Multi-page cut-and-paste packets render more per turn than the other
  // two scenarios in this set; the first run timed out at 600_000ms
  // sharing sandbox capacity with the other two evals (2026-07-29).
  timeoutMs: 1_200_000,
  async test(t) {
    const turns = [
      "Can you make Story a cut-and-paste unit study packet about animal habitats? She loves animals.",
      "This is very surface level. I need the pages filled with activities appropriate for her age, and detailed, lifelike illustrations.",
      "The cut-and-glue boxes need pictures and enough space to fit all the cut-out cards, and there's still a lot of open space at the bottom of the pages.",
      "The coloring images are too small, and there's no way she can cut those tiny boxes at the bottom either. Make the images and boxes bigger to fill the space, don't just add more little things.",
      "The matching boxes still need to be bigger to fit the cut-out cards with images.",
    ];

    const steps = await runConvergenceScenario(t, turns);
    t.loadedSkill("materials-studio");
    printConvergenceTrace("cut-and-paste packet (Story)", steps);

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
