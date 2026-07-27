import { defineEval } from "eve/evals";

/**
 * Positive guard against planner under-routing: putting a curriculum
 * the parent already has onto the planner is the skill body's own
 * declared common ask. This fixture keeps the scope narrowing
 * (scheduling, not authoring) from silently dropping it. The prompt is
 * self-contained on purpose: it names the thing and the days, so an
 * honest clarifying question is never the right first move.
 */
export default defineEval({
  description:
    "Putting a named curriculum onto the planner loads the planner skill.",
  async test(t) {
    await t.send(
      "We're adding a phonics workbook for Maya. Can you put it on her planner for three mornings next week?",
    );
    t.succeeded();
    t.loadedSkill("planner");
  },
});
