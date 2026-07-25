import { defineEval } from "eve/evals";

/**
 * Adjacent negative for the planner/materials boundary: moving an
 * existing lesson between days is planner work and must not pull in
 * the materials studio. Routing assertions only; the eval family has
 * no plan rows, so downstream open_planner results are not asserted.
 * The child is named on purpose: two fixture children share a reading
 * focus, and an unnamed "reading lesson" invites the documented
 * which-child clarifying question instead of a routing decision.
 */
export default defineEval({
  description:
    "Moving an existing lesson to another day loads planner, not materials-studio.",
  async test(t) {
    const turn = await t.send(
      "Can you move Story's Tuesday reading lesson to Thursday?",
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
