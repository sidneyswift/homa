import { defineEval } from "eve/evals";

/** An ordinary calendar commitment belongs in Planner, but it is not evidence
 * that school or enrichment work happened. */
export default defineEval({
  description:
    "A child's dentist appointment becomes a family event, never a completed-learning record.",
  async test(t) {
    await t.send(
      "Please add Story's dentist appointment to our calendar on October 15, 2026 at 2 PM.",
    );
    t.succeeded();
    t.loadedSkill("planner");
    t.calledTool("add_family_event");
    t.notCalledTool("record_planner_activity");
    t.notCalledTool("complete_planner_activity");
  },
});
