import { createProactiveEpisode } from "../lib/conversation-continuity/ledger";
import { agentJobsEnabled } from "../lib/jobs/flag";
import {
  claimNextRunnableJob,
  finalizeCooperativeCancel,
  releaseStageClaim,
} from "../lib/jobs/runner";
import { buildStageBrief, loadJobPlan } from "../lib/jobs/session";

/**
 * One claim cycle of the agent-jobs runner, shared by its two entry
 * points (founder directive 2026-07-23: background jobs start
 * immediately, the cron is the sweeper):
 *
 *  - the 5-minute schedule (agent/schedules/agent-jobs.ts), which now
 *    exists to catch what the immediate path missed: a crashed kick, a
 *    released claim, a retried stage;
 *  - the channel's run-now route (agent/channels/agent-job.ts), which
 *    the job-starting tools call the moment a job row commits, so a
 *    parent's page starts building seconds after the promise, not
 *    minutes.
 *
 * The spawn callback resolves at session ACCEPTANCE, not completion
 * (that is why the claim guard against an in_progress stage exists), so
 * a cycle is a few database writes per claim, never a build's worth of
 * waiting. Claiming is deliberately generic: whichever entry point runs
 * first advances whatever work is runnable, and `for update skip
 * locked` keeps two cycles off the same stage.
 */

export interface StageSpawnInput {
  message: string;
  target: {
    familyId: string;
    jobId: string;
    stageNumber: number;
    skill: string;
    totalStages: number;
    episodeId: string;
  };
  auth: {
    authenticator: string;
    principalId: string;
    principalType: "user";
    attributes: {
      channel: string;
      familyId: string;
      agentJobId: string;
      agentJobStageNumber: string;
      episodeId: string;
    };
  };
}

export async function runAgentJobsCycle(
  spawn: (input: StageSpawnInput) => Promise<unknown>,
  maxStages = 10,
): Promise<number> {
  if (!agentJobsEnabled()) return 0;

  let started = 0;
  for (let i = 0; i < maxStages; i++) {
    const claim = await claimNextRunnableJob();
    if (claim.action === "idle") break;
    if (claim.action === "cancel") {
      await finalizeCooperativeCancel(claim.jobId, claim.familyId, claim.skill);
      continue;
    }

    const job = claim.job;
    try {
      const plan = await loadJobPlan(job.familyId, job.jobId);
      const episodeId = await createProactiveEpisode({ familyId: job.familyId });
      await spawn({
        message: buildStageBrief(job, plan),
        target: {
          familyId: job.familyId,
          jobId: job.jobId,
          stageNumber: job.stageNumber,
          skill: job.skill,
          totalStages: job.totalStages,
          episodeId,
        },
        auth: {
          authenticator: "agent-job-runner",
          principalId: `agent-job:${job.familyId}`,
          principalType: "user" as const,
          attributes: {
            channel: "agent-job",
            familyId: job.familyId,
            agentJobId: job.jobId,
            agentJobStageNumber: String(job.stageNumber),
            episodeId,
          },
        },
      });
      started += 1;
    } catch (error) {
      // The session could not be started; release the claim so the
      // next cycle retries this stage instead of wedging it.
      await releaseStageClaim(job.familyId, job.jobId, job.stageNumber);
      console.error(
        `agent-job runner failed to start job ${job.jobId} stage ${job.stageNumber}:`,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  return started;
}
