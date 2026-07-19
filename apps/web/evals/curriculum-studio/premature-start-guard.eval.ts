import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { parseJobPlan } from "../../lib/jobs/contracts";

/**
 * Fixture 4 of the curriculum-studio five-fixture eval
 * (docs/homa-planning/plans/2026-07-18-curriculum-studio-tweakable-plan.html,
 * build-order stage "curriculum-studio skill v0 + five-fixture eval").
 *
 * Two-turn premature-start guard. On a bare ask (no up-front go-ahead) the
 * skill must draft and confirm the shape before committing weeks of build, so
 * turn one loads the skill but does NOT start a job. Only after the parent
 * confirms does turn two start it, exactly once, with a sane multi-week
 * total_stages. This is the confirm-first counterpart to fixture 1's
 * pre-authorized single-turn start.
 *
 * The eve eval harness drives multiple turns from one session: t.send returns
 * a per-turn handle whose assertions are scoped to just that turn, which is
 * what lets "no start in turn one" and "exactly one start in turn two" both
 * hold in the same run. Wording is paraphrased, never the SKILL.md
 * description.
 */
export default defineEval({
  description:
    "A bare whole-program ask drafts and confirms first (no start), then starts exactly one job after the parent confirms.",
  async test(t) {
    const ask = await t.send(
      "Can you learn All About Reading and put together a full 36 week reading program for my daughter?",
    );
    ask.loadedSkill("curriculum-studio");
    ask.notCalledTool("start_agent_job");

    const confirm = await t.send(
      "Yes, that shape looks great. Please go ahead and start building it.",
    );
    confirm.calledTool("start_agent_job", {
      input: { skill: "curriculum-studio" },
      count: 1,
    });

    const start = confirm.toolCalls.find(
      (call) => call.name === "start_agent_job",
    );
    const totalStages = start?.input.totalStages ?? start?.input.total_stages;
    t.check(
      totalStages,
      satisfies(
        (value) =>
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 2 &&
          value <= 200,
        "start_agent_job total_stages is a sane multi-week count",
      ),
    );
    t.check(
      start?.input.plan ?? null,
      satisfies(
        (plan) => parseJobPlan("curriculum-studio", plan).ok,
        "start_agent_job plan validates against curriculum-studio JOB_CONTRACTS schema",
      ),
    );
  },
});
