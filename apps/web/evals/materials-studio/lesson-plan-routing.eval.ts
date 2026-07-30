import { defineEval } from "eve/evals";

/**
 * Lesson-plan authoring belongs to materials-studio, not the planner.
 * Guards the a4d3b03f production fix (lesson-plan requests wrongly
 * popping the planner canvas) at the description layer, which becomes
 * the only routing signal once the instructions.md router table is
 * gone. Maya is the eval-fixture child with the early-reading focus.
 *
 * "This week" names a topic, not Maya's working edge, so the skill's
 * binding "set the difficulty from evidence" rule used to ask a
 * calibrating question via the structured ask_question/ask_user_questions
 * tool before ever loading materials-studio (observed 2026-07-30:
 * `succeeded` failed with "run parked on 1 unanswered input request(s)",
 * `loadedSkill` failed with "observed tools: [ask_question]"). A plain
 * `t.send()` cannot answer a structured input request, so a single-turn
 * eval with no evidence in the prompt was a coin flip on whether the
 * model happened to have enough context to skip asking, the same bug
 * found and fixed twice in fill-convergence-overflow-equations.eval.ts
 * and franchise-character-fallback.eval.ts the same week
 * (docs/homa-planning/plans/2026-07-29-materials-fill-convergence-evals.md).
 * Naming her working edge directly removed that failure mode: 5 runs
 * after the fix, none parked.
 *
 * What surfaced once the parking stopped is real product variance, not
 * an eval artifact, and this eval is now doing its job of catching it:
 * of those 5 runs, 3 correctly loaded materials-studio, 1 answered a
 * genuinely good lesson plan in plain chat with no tool call at all
 * (arguably fine content, but not what this eval asserts), and 1
 * reproduced the exact a4d3b03f regression this eval exists to catch,
 * open_planner. That routing non-determinism is real and still open,
 * tracked in gh#243/gh#248; fixing it is a materials-studio/planner
 * routing question, out of scope for an eval-hygiene pass.
 */
export default defineEval({
  description:
    "A request to write a lesson plan loads materials-studio and does not open the planner.",
  async test(t) {
    await t.send(
      "Can you write me a lesson plan for Maya's reading this week? She's blending simple CVC words now, working toward short sentences.",
    );
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.notCalledTool("open_planner");
  },
});
