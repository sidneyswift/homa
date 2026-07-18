import { defineChannel, GET } from "eve/channels";

import { mapDb } from "../../lib/map/db";
import { failStage, type ClaimedJob } from "../../lib/jobs/runner";

/**
 * The job runner's build channel (agent-jobs runner spec). It wakes a
 * session as the family to build ONE stage and, unlike the dispatch
 * channel, it never delivers anything to the parent per stage: a stage's
 * result is captured by the report_agent_job_stage tool the build session
 * calls, not by composing and sending the session's reply. This channel
 * only watches for a session that ended WITHOUT reporting (a build that
 * failed or stalled) and parks that stage as needs-attention.
 *
 * Milestone delivery (a finished volume, the completed build) is a
 * separate, deliberate step, not this per-stage path, so a 36-stage build
 * never texts the parent 36 times.
 */

interface AgentJobState {
  familyId: string | null;
  jobId: string | null;
  stageNumber: number | null;
  skill: string | null;
  totalStages: number | null;
  episodeId: string | null;
}

async function stageStillInProgress(
  familyId: string,
  jobId: string,
  stageNumber: number,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ status: string }[]>`
    select status from public.agent_job_stages
    where job_id = ${jobId} and family_id = ${familyId} and stage_number = ${stageNumber}
  `;
  return rows[0]?.status === "in_progress";
}

/** The session ended. If its stage never reached a reported state, the
 * build session failed or stalled without calling report_agent_job_stage;
 * park the stage so nothing is lost and the parent can retry. */
async function failIfUnreported(state: AgentJobState, reason: string): Promise<void> {
  const { familyId, jobId, stageNumber, skill, totalStages } = state;
  if (!familyId || !jobId || stageNumber === null) return;
  if (!(await stageStillInProgress(familyId, jobId, stageNumber))) return;
  const job: ClaimedJob = {
    jobId,
    familyId,
    skill: skill ?? "",
    childId: null,
    title: "",
    planRevision: 1,
    stageNumber,
    totalStages: totalStages ?? stageNumber,
  };
  await failStage(job, reason);
}

export default defineChannel({
  state: {
    familyId: null,
    jobId: null,
    stageNumber: null,
    skill: null,
    totalStages: null,
    episodeId: null,
  } as AgentJobState,

  context(state) {
    return { state };
  },

  metadata(state) {
    return { adapterName: "agent-job", jobId: state.jobId };
  },

  async receive(input, { send }) {
    const target = (input.target ?? {}) as Partial<AgentJobState>;
    return await send(input.message, {
      auth: input.auth ?? null,
      continuationToken: `agent-job:${target.jobId ?? ""}:${target.stageNumber ?? ""}`,
      state: {
        familyId: target.familyId ?? null,
        jobId: target.jobId ?? null,
        stageNumber: target.stageNumber ?? null,
        skill: target.skill ?? null,
        totalStages: target.totalStages ?? null,
        episodeId: target.episodeId ?? null,
      } satisfies AgentJobState,
      title: `agent-job ${target.jobId ?? ""} stage ${target.stageNumber ?? ""}`.trim(),
    });
  },

  events: {
    async "turn.completed"(_eventData, channel) {
      await failIfUnreported(
        channel.state,
        "the build session ended without producing this stage's material",
      );
    },
    async "turn.failed"(_eventData, channel) {
      await failIfUnreported(channel.state, "the build session failed");
    },
    async "session.failed"(_eventData, channel) {
      await failIfUnreported(channel.state, "the build session failed to run");
    },
  },

  routes: [
    // A channel with zero routes has no route fingerprint and cannot be
    // dispatched to (same reason the dispatch channel keeps a health route).
    GET("/eve/v1/agent-job/health", async () => Response.json({ ok: true })),
  ],
});
