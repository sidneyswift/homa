import { defineEval } from "eve/evals";

/** Founder transcript fixture: a concrete recap belongs in Planner even when
 * no generated month already contains those lessons. */
export default defineEval({
  description:
    "A parent recap of completed curriculum and PE loads Planner and records each activity.",
  async test(t) {
    await t.send(
      "Today Maya finished Horizons lesson 42, and Story did gymnastics for PE. Please log both.",
    );
    t.succeeded();
    t.loadedSkill("planner");
    t.calledTool("record_planner_activity");
    t.notCalledTool("manage_child_progress");
  },
});
