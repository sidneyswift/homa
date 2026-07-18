/**
 * The M3-08 no-runaway-loops law (HT-6): sessions started by automated
 * work must never reach the schedule CRUD tools, or one run could create
 * more runs. Shared by all four task tools so the rule cannot drift.
 */
export function refuseScheduleSpawnedSession(attributes: unknown): string | null {
  const channel = ((attributes ?? {}) as { channel?: string }).channel;
  if (
    channel === "dispatch"
    || channel === "research"
    || channel === "subject_lesson"
  ) {
    return "Automated runs cannot create or change scheduled tasks (that would let automated work create more automated work). Tell the parent to ask in a normal conversation or use Homa's tasks page.";
  }
  return null;
}
