import { defineEval } from "eve/evals";

import {
  assertConvergence,
  printConvergenceTrace,
  runConvergenceScenario,
} from "./fill-convergence-support";

/**
 * A real revision saga, paraphrased onto Finn: a themed math practice
 * packet whose pages kept coming back with a dead band at the bottom,
 * "still filling the pages" answered by adding a few more problems
 * instead of scaling what was already there, never fully resolved across
 * dozens of rounds. Provenance, real wording, and the family this is
 * drawn from live only in
 * docs/homa-planning/plans/2026-07-29-materials-fill-convergence-evals.md;
 * this file never carries a real family id or a real child's name.
 *
 * Turn 1 is the plain opening ask, no complaint baked in: the strongest
 * signal the 2026-07-29 fixes (worksheet-scale-to-fill ruling, gh#349
 * geometry feedback) worked is converging here, before any parent
 * pushback. Turns 2+ are the real complaint sequence, in order, for a
 * system that still needs correcting.
 *
 * Needs the sandbox for family-scoped tools:
 * `pnpm eval:sandbox materials-studio/fill-convergence-counting-packet`.
 */
export default defineEval({
  description:
    "A themed counting/addition packet converges to a fill-clean page within a few turns, not a dozen.",
  // CI's full eval run shares the model gateway and render capacity
  // across ~25 concurrent evals; 900_000ms timed out there on 2026-07-29
  // even though it comfortably converged locally in isolation.
  timeoutMs: 1_200_000,
  async test(t) {
    const turns = [
      "Can you make Finn a dinosaur-themed counting and addition practice packet? He's working on counting to 20.",
      "Fill up the page, and can we get a better dinosaur graphic too?",
      "The page needs to be filled with problems. Only half the page has anything on it.",
      "Space still on the bottom of page 2.",
      "There is still about a quarter of the page open on the bottom of pages 1 and 2. Fill it up please.",
      "I just want the pages to be filled.",
    ];

    const steps = await runConvergenceScenario(t, turns);
    t.loadedSkill("materials-studio");
    printConvergenceTrace("counting packet (Finn)", steps);
    assertConvergence(t, steps);
  },
});
