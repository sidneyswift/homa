import { defineEval } from "eve/evals";

/**
 * Adversarial neighbor for gh#243: naming a lesson plan does not make an
 * existing plan into an authoring request. Scheduling onto a real day is
 * planner work, and must not create another material.
 */
export default defineEval({
  description:
    "Scheduling an existing lesson plan uses Planner without creating a new material.",
  async test(t) {
    await t.send(
      "I already have Maya's reading lesson plan. Put it on Tuesday's planner, and don't write a new one.",
    );
    t.succeeded();
    t.loadedSkill("planner");
    t.calledTool("open_planner");
    t.notCalledTool("create_printable");
  },
});
