/**
 * The M3-08 no-runaway-loops law (HT-6): sessions that a schedule
 * started must never reach the schedule CRUD tools, or a task could
 * create tasks. Shared by all four task tools so the rule cannot drift.
 */
export function refuseScheduleSpawnedSession(attributes: unknown): string | null {
  const channel = ((attributes ?? {}) as { channel?: string }).channel;
  if (channel === "dispatch" || channel === "research") {
    return "Scheduled runs cannot create or change scheduled tasks (that would let tasks breed tasks). Tell the parent to ask in a normal conversation or use the Homa's tasks page.";
  }
  return null;
}
