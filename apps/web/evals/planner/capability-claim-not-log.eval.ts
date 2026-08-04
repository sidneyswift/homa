import { defineEval } from "eve/evals";

/** A capability claim can feed ChildProgress, but it does not prove that a
 * dated learning activity happened. Planner must not manufacture history. */
export default defineEval({
  description:
    "A child capability claim without a dated activity is not logged in Planner.",
  async test(t) {
    const turn = await t.send("Maya can count to 100 on her own now.");
    t.succeeded();
    t.notCalledTool("record_planner_activity");
    t.notCalledTool("complete_planner_activity");
    t.eventsSatisfy(
      "planner was not loaded for a capability-only claim",
      () =>
        turn.toolCalls.every(
          (call) =>
            call.name !== "load_skill"
            || call.input.skill !== "planner",
        ),
    );
  },
});
