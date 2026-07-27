import { defineEval } from "eve/evals";

/**
 * Positive guard: asking what is on the week is a planner moment and
 * should load the planner skill before any planner tool work.
 */
export default defineEval({
  description: "Asking what is on the week loads the planner skill.",
  async test(t) {
    await t.send("What's on our week?");
    t.succeeded();
    t.loadedSkill("planner");
  },
});
