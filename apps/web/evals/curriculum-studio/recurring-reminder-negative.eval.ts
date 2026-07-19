import { defineEval } from "eve/evals";

/**
 * Fixture 3 of the curriculum-studio five-fixture eval
 * (docs/homa-planning/plans/2026-07-18-curriculum-studio-tweakable-plan.html,
 * build-order stage "curriculum-studio skill v0 + five-fixture eval").
 *
 * Adjacent-negative on the other side: a recurring reminder is a create_task,
 * never a finite build job. The skill is explicit that create_task makes a
 * repeating chore and must not stand in for a curriculum build; this fixture
 * pins the reverse, that a plain recurring reminder does not get pulled into
 * start_agent_job. The message supplies the day, hour, and delivery channel
 * and an explicit go-ahead so the tool's confirm-first rule is already
 * satisfied. Wording is paraphrased, never the SKILL.md description.
 */
export default defineEval({
  description:
    "A recurring reminder fires create_task and does not start a background build job.",
  async test(t) {
    await t.send(
      "Every Monday at 9am, please text me a reminder to start our homeschool morning. The day, time, and text delivery are all set, go ahead and put it in place.",
    );
    t.succeeded();
    t.calledTool("create_task");
    t.notCalledTool("start_agent_job");
  },
});
