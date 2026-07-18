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
