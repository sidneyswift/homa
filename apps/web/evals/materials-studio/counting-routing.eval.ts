import { defineEval } from "eve/evals";

/**
 * Routing coverage for the counting subject decision rules folded into
 * materials-studio (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md
 * §5.2, §8.2), migrated off the retired skill_bank row of the same name.
 */
export default defineEval({
  description: "An early-number practice request loads materials-studio.",
  async test(t) {
    await t.send("Finn loves counting dinosaurs, can you make him a worksheet for that?");
    t.succeeded();
    t.loadedSkill("materials-studio");
  },
});
