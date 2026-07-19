import { defineSchedule } from "eve/schedules";

import { createProactiveEpisode } from "../../lib/conversation-continuity/ledger";
import { agentJobsEnabled } from "../../lib/jobs/flag";
import {
  claimNextRunnableJob,
  finalizeCooperativeCancel,
  reapStaleJobStages,
  releaseStageClaim,
} from "../../lib/jobs/runner";
import { buildStageBrief, loadJobPlan } from "../../lib/jobs/session";
import agentJobChannel from "../channels/agent-job";

/**
 * The agent-jobs runner (agent-jobs runner spec). Every few minutes it
 * claims the next runnable stage of each active job and wakes a session as
 * that family to build it. This is the claim-lease loop the plan chose over
 * a second Vercel Workflow runtime: the claim leases the stage by moving it
 * to in_progress under `for update skip locked`, so concurrent ticks never
 * build the same stage, and Postgres stays the only source of truth.
 *
 * Flag-gated: HOMA_AGENT_JOBS_ENABLED off means this tick is a cheap no-op,
 * so the whole feature ships dark and this schedule does nothing until the
 * flag flips (after the live preview probe the runner spec requires).
 *
 * One stage per job per tick (a job's next stage cannot start until the
 * current one finishes), so this drives many families' builds forward in
 * parallel while each single build advances one stage at a time.
 */

const MAX_STAGES_PER_TICK = 10;

export default defineSchedule({
  cron: "*/5 * * * *",
  run({ receive, waitUntil }) {
    waitUntil(
      (async () => {
        if (!agentJobsEnabled()) return;

        // Recover any stage whose serverless build was hard-killed (timeout,
        // OOM) before its turn/session events could release the lease. Without
        // this, the stage stays in_progress and claimNextRunnableJob excludes
        // its job forever. Runs before the claim loop so a stage released back
        // to pending here can be re-claimed in this same tick.
        await reapStaleJobStages();

        for (let i = 0; i < MAX_STAGES_PER_TICK; i++) {
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
            await receive(agentJobChannel, {
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
          } catch (error) {
            // The session could not be started; release the claim so the
            // next tick retries this stage instead of wedging it.
            await releaseStageClaim(job.familyId, job.jobId, job.stageNumber);
            console.error(
              `agent-job runner failed to start job ${job.jobId} stage ${job.stageNumber}:`,
              error instanceof Error ? error.message : "unknown",
            );
          }
        }
      })(),
    );
  },
});
