/**
 * Jobs cannot breed jobs (agent-jobs plan, expert council 2026-07-18):
 * the same idiom as lib/tasks/guard.ts's refuseScheduleSpawnedSession,
 * extended to the job runner. A session that a schedule, a research run,
 * or the job runner itself started must never reach the job lifecycle
 * tools, or a background run could spawn or steer background runs. Shared
 * by all four agent-job tools so the rule cannot drift.
 */
export function refuseJobSpawnedSession(attributes: unknown): string | null {
  const channel = ((attributes ?? {}) as { channel?: string }).channel;
  if (channel === "dispatch" || channel === "research" || channel === "agent-job") {
    return "A background run cannot start or steer jobs (that would let jobs breed jobs). This belongs in a normal conversation with the parent.";
  }
  return null;
}

/** The inverse, for report_agent_job_stage: only the job runner's own build
 * session (channel 'agent-job') may report a stage result. A parent chat or
 * any other surface calling it is refused, so a stage can only be completed
 * by the worker actually building it. */
export function refuseNonJobWorkerSession(attributes: unknown): string | null {
  const channel = ((attributes ?? {}) as { channel?: string }).channel;
  if (channel !== "agent-job") {
    return "Only the job runner's own build session can report a stage result.";
  }
  return null;
}

/** The build session carries its job and stage on the auth attributes the
 * runner stamped (never model input); this reads them back. */
export function jobWorkerContext(
  attributes: unknown,
): { jobId: string; stageNumber: number } | null {
  const attrs = (attributes ?? {}) as { agentJobId?: unknown; agentJobStageNumber?: unknown };
  const jobId = typeof attrs.agentJobId === "string" ? attrs.agentJobId : null;
  const stageNumber =
    typeof attrs.agentJobStageNumber === "number" ? attrs.agentJobStageNumber : null;
  if (!jobId || stageNumber === null) return null;
  return { jobId, stageNumber };
}
