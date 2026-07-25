import { defineEval } from "eve/evals";

/**
 * Adjacent negative for the planner/materials boundary: moving an
 * existing lesson between days is planner work and must not pull in
 * the materials studio. Routing assertions only; the eval family has
 * no plan rows, so downstream open_planner results are not asserted.
 */
export default defineEval({
  description:
    "Moving an existing lesson to another day loads planner, not materials-studio.",
  async test(t) {
    const turn = await t.send(
      "Can you move Tuesday's reading lesson to Thursday?",
    );
    t.succeeded();
    t.loadedSkill("planner");
    t.eventsSatisfy(
      "materials-studio was not loaded",
      () =>
        turn.toolCalls.every(
          (call) =>
            call.name !== "load_skill"
            || call.input.skill !== "materials-studio",
        ),
    );
  },
});
