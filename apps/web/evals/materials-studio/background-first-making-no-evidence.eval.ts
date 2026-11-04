import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import {
  EVAL_BACKGROUND_MAKING_FIXTURE_CHILD_ID,
  EVAL_BACKGROUND_MAKING_FIXTURE_FAMILY_ID,
  EVAL_BACKGROUND_MAKING_FIXTURE_JOB_ID,
  EVAL_BACKGROUND_MAKING_MODE_HEADER_VALUE,
  EVAL_ONBOARDING_MODE_HEADER,
  isEvalFamilyFixtureDbBacked,
} from "../../lib/family-context-eval-fixture";
import { type ClaimedJob } from "../../lib/jobs/runner";
import { buildStageBrief, loadJobPlan } from "../../lib/jobs/session";
import { mapDb } from "../../lib/map/db";

interface StageRow {
  title: string;
  plan_revision: number;
  stage_status: string;
}

/**
 * gh#1252. A brand-new family's first making runs as a background agent
 * job with nobody in the session. Theo has an age, a love (sharks), and
 * the subject his parent picked (reading), and no evidence about his
 * level: no memories, no map. The skill's
 * interactive rule ("ask ONE calibrating question") used to win over the
 * job brief, so the build ended on a question nobody could answer, never
 * reported, and failed after three attempts. Passing requires the real
 * outcome: a practice page created and the stage recorded through
 * report_agent_job_stage, with no question asked. A coloring page does
 * not count: it sidesteps the level decision instead of making one
 * (observed on the unfixed skill, 2026-11-04).
 *
 * The session is stamped exactly as agent-jobs-cycle.ts stamps a build
 * session, the job row is seeded as the runner leaves it after a claim,
 * and the message is the production buildStageBrief over the plan the
 * mobile making route writes. The interactive counterpart is
 * interactive-no-evidence-asks.eval.ts.
 *
 * Run with:
 * `pnpm eval:sandbox materials-studio/background-first-making-no-evidence`
 */
export default defineEval({
  description:
    "A background first making with no evidence about the child builds and reports a page instead of asking a calibrating question.",
  tags: ["model-backed", "materials-studio", "agent-jobs"],
  timeoutMs: 480_000,
  async test(t) {
    if (!isEvalFamilyFixtureDbBacked(process.env)) {
      throw new Error(
        "This eval needs the seeded job row: run it with `pnpm eval:sandbox materials-studio/background-first-making-no-evidence`.",
      );
    }

    const sql = mapDb();
    const before = await sql<StageRow[]>`
      select j.title, j.plan_revision, s.status as stage_status
      from public.agent_jobs j
      join public.agent_job_stages s
        on s.job_id = j.id and s.family_id = j.family_id
      where j.id = ${EVAL_BACKGROUND_MAKING_FIXTURE_JOB_ID}
        and j.family_id = ${EVAL_BACKGROUND_MAKING_FIXTURE_FAMILY_ID}
        and s.stage_number = 1
    `;
    const seeded = before[0];
    if (!seeded || seeded.stage_status !== "in_progress") {
      throw new Error(
        `the seeded first-making stage is not building (${seeded?.stage_status ?? "missing"}); start a fresh sandbox`,
      );
    }

    const job: ClaimedJob = {
      jobId: EVAL_BACKGROUND_MAKING_FIXTURE_JOB_ID,
      familyId: EVAL_BACKGROUND_MAKING_FIXTURE_FAMILY_ID,
      skill: "materials-studio",
      childId: EVAL_BACKGROUND_MAKING_FIXTURE_CHILD_ID,
      title: seeded.title,
      planRevision: seeded.plan_revision,
      stageNumber: 1,
      totalStages: 1,
    };
    const plan = await loadJobPlan(job.familyId, job.jobId);

    const turn = await t.send({
      message: buildStageBrief(job, plan),
      headers: {
        [EVAL_ONBOARDING_MODE_HEADER]: EVAL_BACKGROUND_MAKING_MODE_HEADER_VALUE,
      },
    });
    t.log(
      JSON.stringify({
        phase: "settled-turn-before-assertions",
        response: t.reply,
        tools: turn.toolCalls.map((call) => call.name),
      }),
    );

    t.succeeded();
    t.notCalledTool("ask_question");
    t.loadedSkill("materials-studio");
    t.calledTool("create_printable", {
      input: { kind: (kind: unknown) => kind !== "coloring" },
    });
    t.calledTool("report_agent_job_stage", { output: { recorded: true } });

    const after = await sql<{ stage_status: string; artifacts: string }[]>`
      select s.status as stage_status, count(a.id)::text as artifacts
      from public.agent_job_stages s
      left join public.agent_job_stage_artifacts a
        on a.stage_id = s.id and a.family_id = s.family_id
      where s.job_id = ${job.jobId} and s.family_id = ${job.familyId}
        and s.stage_number = 1
      group by s.status
    `;
    const stage = after[0];
    const stageFinished =
      stage !== undefined &&
      stage.stage_status !== "in_progress" &&
      Number(stage.artifacts) > 0;
    t.check(
      stageFinished,
      satisfies(
        (value) => value === true,
        "the stage left in_progress with the built material linked to it",
      ),
    );
  },
});
