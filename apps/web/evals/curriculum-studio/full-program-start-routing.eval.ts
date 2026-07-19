import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { parseJobPlan } from "../../lib/jobs/contracts";

/**
 * Fixture 1 of the curriculum-studio five-fixture eval
 * (docs/homa-planning/plans/2026-07-18-curriculum-studio-tweakable-plan.html,
 * build-order stage "curriculum-studio skill v0 + five-fixture eval").
 *
 * Positive / anti-refusal routing. A whole-program request must load
 * curriculum-studio and start a real background job, NOT refuse and call no
 * tool (the exact bug agent-jobs + curriculum-studio was built to fix) and
 * NOT collapse into a recurring create_task reminder.
 *
 * The parent pre-authorizes the build ("start it, do not wait for me to
 * confirm"), which the skill treats as the up-front confirmation, so the job
 * may start in this one turn. The two-turn premature-start guard
 * (premature-start-guard.eval.ts) covers the confirm-first path for a bare
 * ask. Wording is paraphrased on purpose, never the SKILL.md description.
 *
 * Folded-in fixture (5): a soft plan-parses assertion proves the plan the
 * model handed start_agent_job validates against curriculum-studio's
 * JOB_CONTRACTS schema, the same shape startJob enforces server-side. Soft
 * because the plan's field shape is model-produced; a miss is a signal the
 * skill should document the plan shape, not a reason to fail the suite.
 */
export default defineEval({
  description:
    "A whole-program build request loads curriculum-studio and starts a background job instead of refusing.",
  async test(t) {
    const turn = await t.send(
      "I want the full All About Reading program for my daughter, the whole 36 week sequence. I already know that is the scope I want, so please do not wait for me to confirm each step, just start building it now.",
    );
    t.succeeded();
    t.loadedSkill("curriculum-studio");
    t.calledTool("start_agent_job", { input: { skill: "curriculum-studio" } });
    t.notCalledTool("create_task");

    const start = turn.toolCalls.find((call) => call.name === "start_agent_job");
    t.check(
      start?.input.plan ?? null,
      satisfies(
        (plan) => parseJobPlan("curriculum-studio", plan).ok,
        "start_agent_job plan validates against curriculum-studio JOB_CONTRACTS schema",
      ),
    ).soft();
  },
});
