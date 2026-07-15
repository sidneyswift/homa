import { defineEval } from "eve/evals";

/**
 * Routing coverage for the letter-sounds subject decision rules folded
 * into materials-studio (docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md
 * §5.2, §8.2), migrated off the retired skill_bank row of the same name.
 * Paraphrased on purpose, never the SKILL.md description string itself.
 */
export default defineEval({
  description: "A letter-practice request loads materials-studio.",
  async test(t) {
    await t.send(
      "Can you make Maya a page to practice the letter M? She's working on her letter sounds.",
    );
    t.succeeded();
    t.loadedSkill("materials-studio");
  },
});
