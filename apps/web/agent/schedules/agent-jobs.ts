import { sendEveChannelTarget } from "../../lib/conversation-continuity/eve-channel-send";
import { defineSchedule } from "eve/schedules";

import { runAgentJobsCycle } from "../agent-jobs-cycle";
import agentJobChannel from "../channels/agent-job";

/**
 * The agent-jobs sweeper (agent-jobs runner spec; founder directive
 * 2026-07-23: background jobs start immediately). New jobs are claimed
 * the moment they are created, by the run-now kick the job-starting
 * tools fire (agent/agent-jobs-cycle.ts has the shared cycle). This
 * schedule is the reliability floor under that: it catches whatever the
 * immediate path missed, a kick that failed, a stage released after a
 * spawn error, a retried stage waiting for another attempt, so no job
 * ever depends on the kick having worked.
 *
 * Flag-gated inside the cycle: HOMA_AGENT_JOBS_ENABLED off means every
 * entry point is a cheap no-op and the whole feature ships dark.
 *
 * One stage per job per cycle (a job's next stage cannot start until
 * the current one finishes), so this drives many families' builds
 * forward in parallel while each single build advances one stage at a
 * time.
 */

export default defineSchedule({
  cron: "*/5 * * * *",
  run(scheduleOps) {
    const { waitUntil } = scheduleOps;
    waitUntil(
      runAgentJobsCycle((input) => sendEveChannelTarget(scheduleOps, agentJobChannel, input)),
    );
  },
});
