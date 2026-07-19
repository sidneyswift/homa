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
    `You are running a BACKGROUND build for this family: "${job.title}". No one is`,
    "reading your words. This is not a conversation. Do NOT reply with text, do NOT",
    "ask a question, do NOT acknowledge. Nobody will answer, and any text you write",
    "is discarded. You must ACT with tools, starting immediately in this turn.",
    "",
    `This is stage ${job.stageNumber} of ${job.totalStages}. Build ONLY this stage.`,
    "",
    "Do exactly this, in order, using tool calls only:",
    `1. Call load_skill with skill "${job.skill}" and follow its craft for one stage.`,
    "2. Build this stage's material (create_printable, using the materials-studio",
    "   craft), aimed at the child's level from your family context. If you have no",
    "   reading for the child, aim at a sensible level for their age; never stop to",
    "   ask, there is no one to ask.",
    "3. The moment a material passes its quality check, call report_agent_job_stage",
    "   with its id(s). That is the ONLY way to finish this build.",
    "",
    "The plan (scope and sequence) for the whole build:",
    planText,
    "",
    "Reminder: build ONLY this one stage, never message the parent, never promise",
    "anything, and finish only by calling report_agent_job_stage. Begin now with",
    "load_skill.",
  ].join("\n");
}
