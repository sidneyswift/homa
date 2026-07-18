import { mapDb } from "../map/db";
import type { ClaimedJob } from "./runner";

/**
 * The build session's inputs (agent-jobs runner spec). The runner claims a
 * stage, loads the job's plan, and wakes a session as the family to build
 * exactly that one stage and report it. The session already receives the
 * family and child context on turn.started (family-context.ts), so the
 * brief only carries the job, the stage, and the plan.
 */

export async function loadJobPlan(
  familyId: string,
  jobId: string,
): Promise<unknown | null> {
  const sql = mapDb();
  const rows = await sql<{ plan: unknown }[]>`
    select plan from public.agent_jobs
    where id = ${jobId} and family_id = ${familyId}
  `;
  return rows[0]?.plan ?? null;
}

/** The message that tells the build session what to do. It never delivers
 * to the parent; it builds the stage's material and calls
 * report_agent_job_stage. */
export function buildStageBrief(job: ClaimedJob, plan: unknown): string {
  const planText = JSON.stringify(plan ?? {}, null, 2);
  return [
    `You are running a background build for this family: "${job.title}".`,
    `This is stage ${job.stageNumber} of ${job.totalStages}. Build ONLY this stage.`,
    `The build follows the ${job.skill} skill; load it and follow its procedure for one stage.`,
    "",
    "The plan (scope and sequence) for the whole build:",
    planText,
    "",
    "Build this stage's material with the materials-studio craft, aimed at the",
    "child's real level from your family context. When the material passes its",
    "quality check, finish by calling report_agent_job_stage with its id(s).",
    "",
    "This is a background build: do NOT write a message to the parent, do NOT",
    "promise anything, and do NOT do more than this one stage. The only way to",
    "finish is report_agent_job_stage.",
  ].join("\n");
}
