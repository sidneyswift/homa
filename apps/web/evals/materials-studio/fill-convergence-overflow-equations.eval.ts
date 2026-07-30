import { defineEval } from "eve/evals";

import {
  assertConvergence,
  printConvergenceTrace,
  runConvergenceScenario,
} from "./fill-convergence-support";

/**
 * The other direction of the same defect: content that runs PAST the
 * page box instead of falling short of it. Real transcripts (paraphrased
 * onto Maya; provenance in
 * docs/homa-planning/plans/2026-07-29-materials-fill-convergence-evals.md)
 * carry both directions, "fit on 1 page" (a themed equation packet
 * spilled past one sheet) and "the bottom got cut off" (an image-heavy
 * page overflowed after an art change), but the three other scenarios in
 * this set all happened to converge from the underfill side. This one
 * exercises the overflow branch of geometryToolNotes directly: the same
 * `evaluateCreatePrintableOutput` predicate treats overflow and underfill
 * as equally "not usable", so an eval set that never triggers overflow
 * cannot tell a real fix from one that only ever tests underfill.
 *
 * Needs the sandbox for family-scoped tools:
 * `pnpm eval:sandbox materials-studio/fill-convergence-overflow-equations`.
 */
export default defineEval({
  description:
    "A themed equation-decoder page that runs past one sheet converges to a fill-clean, non-overflowing page within a few turns.",
  timeoutMs: 1_200_000,
  async test(t) {
    // First run (2026-07-29) never converged in 3 turns: Maya's seeded
    // fixture profile has no math evidence at all (her focus is letter
    // sounds and early reading), so the skill's binding "set the
    // difficulty from evidence" rule correctly stalled on a calibrating
    // question my scripted turns never answered. Naming her working edge
    // directly in turn 1 (the real transcript's own words, from Leo, the
    // real incident this is paraphrased from: "already solves multi-step
    // equations like 3x + 4 = 19 easily") supplies that evidence up
    // front, the same fix applied to franchise-character-fallback.eval.ts.
    const turns = [
      "Can you make Maya a Doctor Who themed equation decoder page? She already solves multi-step equations like 3x + 4 = 19 easily, so aim a step past that: six fraction and decimal equations, and the answers spell out a hidden word using a decoder key.",
      "Please fit it on one page, and make the hidden word something fun from the Doctor Who universe, not just Tardis.",
      "The bottom is still getting cut off. Resize the text so it all fits on the one page.",
    ];

    const steps = await runConvergenceScenario(t, turns);
    t.loadedSkill("materials-studio");
    printConvergenceTrace("equation decoder page, overflow direction (Maya)", steps);
    assertConvergence(t, steps);
  },
});
