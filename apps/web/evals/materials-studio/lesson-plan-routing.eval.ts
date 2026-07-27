import { defineEval } from "eve/evals";

/**
 * Lesson-plan authoring belongs to materials-studio, not the planner.
 * Guards the a4d3b03f production fix (lesson-plan requests wrongly
 * popping the planner canvas) at the description layer, which becomes
 * the only routing signal once the instructions.md router table is
 * gone. Maya is the eval-fixture child with the early-reading focus.
 */
export default defineEval({
  description:
    "A request to write a lesson plan loads materials-studio and does not open the planner.",
  async test(t) {
    await t.send(
      "Can you write me a lesson plan for Maya's reading this week?",
    );
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.notCalledTool("open_planner");
  },
});
