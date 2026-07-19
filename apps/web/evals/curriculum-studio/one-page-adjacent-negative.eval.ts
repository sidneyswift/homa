import { defineEval } from "eve/evals";

/**
 * Fixture 2 of the curriculum-studio five-fixture eval
 * (docs/homa-planning/plans/2026-07-18-curriculum-studio-tweakable-plan.html,
 * build-order stage "curriculum-studio skill v0 + five-fixture eval").
 *
 * Adjacent-negative: a one-page worksheet is not a multi-week program. The
 * request must stay a materials-studio one-off and must NOT start a
 * background job. This catches over-triggering, the opposite failure from
 * fixture 1's refusal. Wording is paraphrased, never the SKILL.md
 * description.
 */
export default defineEval({
  description:
    "A single-worksheet request stays a materials-studio one-off and does not start a background job.",
  async test(t) {
    await t.send(
      "Could you make Theo one worksheet to practice his letter sounds? Just a single page for today.",
    );
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.notCalledTool("start_agent_job");
  },
});
