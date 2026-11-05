import { defineChannel, GET, POST } from "eve/channels";

import { mapDb } from "../../lib/map/db";
import { observeConversationJobEnd, type ConversationJobObservation } from "../../lib/conversation-jobs";
import { handleUnreportedStage, type ClaimedJob } from "../../lib/jobs/runner";
import { stageContinuationToken } from "../../lib/jobs/session";
import { runAgentJobsCycle } from "../agent-jobs-cycle";

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
 * retry it on the next tick a few times, then park it so nothing is lost. */
async function failIfUnreported(state: AgentJobState, reason: string, session: ConversationJobObservation): Promise<void> {
  const { familyId, jobId, stageNumber, skill, totalStages } = state;
  if (!familyId || !jobId || stageNumber === null) return;
  if (await observeConversationJobEnd(familyId, jobId, session)) return;
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
  await handleUnreportedStage(job, reason);
}

/** The send options for one stage's build session, shared by the two
 * ways a stage gets spawned: the schedule's receive() and the run-now
 * route below. One builder so the paths cannot drift. */
function stageSendOptions(input: {
  target?: Partial<AgentJobState> | undefined;
  auth?: unknown;
}) {
  const target = (input.target ?? {}) as Partial<AgentJobState>;
  return {
    auth: (input.auth ?? null) as never,
    continuationToken: stageContinuationToken(target),
    state: {
      familyId: target.familyId ?? null,
      jobId: target.jobId ?? null,
      stageNumber: target.stageNumber ?? null,
      skill: target.skill ?? null,
      totalStages: target.totalStages ?? null,
      episodeId: target.episodeId ?? null,
    } satisfies AgentJobState,
    title: `agent-job ${target.jobId ?? ""} stage ${target.stageNumber ?? ""}`.trim(),
  };
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

  context(state, session) {
    return { state, session };
  },

  metadata(state) {
    return { adapterName: "agent-job", jobId: state.jobId };
  },

  async receive(input, { send }) {
    return await send(input.message, stageSendOptions(input));
  },

  events: {
    async "turn.completed"(event, channel) {
      await failIfUnreported(
        channel.state,
        "the build session ended without producing this stage's material",
        {id:channel.session.id,auth:channel.session.auth,turn:{id:event.turnId,sequence:event.sequence}},
      );
    },
    async "turn.failed"(event, channel) {
      await failIfUnreported(channel.state, "the build session failed", {id:channel.session.id,auth:channel.session.auth,
        turn:{id:event.turnId,sequence:event.sequence}});
    },
    async "session.failed"(_eventData, channel) {
      await failIfUnreported(channel.state, "the build session failed to run", channel.session);
    },
  },

  routes: [
    // A channel with zero routes has no route fingerprint and cannot be
    // dispatched to (same reason the dispatch channel keeps a health route).
    GET("/eve/v1/agent-job/health", async () => Response.json({ ok: true })),

    // Immediate pickup (founder directive 2026-07-23: background jobs
    // start immediately). The job-starting tools call this the moment a
    // job row commits; it runs the same claim cycle the sweeper runs,
    // so the first stage starts building in seconds. Best-effort by
    // design: a missed kick costs at most one sweeper interval, never a
    // job. CRON_SECRET bearer auth, same as the dispatch run-now route;
    // path under /eve/v1/ on purpose, only /eve/* is guaranteed to
    // reach the eve runtime through proxy.ts and the withEve() mount.
    POST<AgentJobState>("/eve/v1/agent-job/run-now", async (req, { send }) => {
      const secret = process.env.CRON_SECRET;
      if (!secret) return Response.json({ ok: false }, { status: 503 });
      if (req.headers.get("authorization") !== `Bearer ${secret}`) {
        return Response.json({ ok: false }, { status: 401 });
      }
      const started = await runAgentJobsCycle(async (input) =>
        await send(input.message, stageSendOptions(input)),
      );
      return Response.json({ ok: true, started });
    }),
  ],
});
