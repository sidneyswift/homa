/**
 * Shared vocabulary for the hours record (M3-05 slice). One subject list
 * for the agent tool, the voice webhook, the events registry, and the
 * dashboard card, so a subject can never exist in one surface and not
 * another. Mirrors the check constraint in migration #37.
 */

export const HOURS_SUBJECTS = [
  "reading",
  "math",
  "science",
  "social studies",
  "art",
  "music",
  "PE",
  "co-op",
  "life skills",
  "other",
] as const;

export type HoursSubject = (typeof HOURS_SUBJECTS)[number];

export function isHoursSubject(value: string): value is HoursSubject {
  return (HOURS_SUBJECTS as readonly string[]).includes(value);
}

/** "1h 45m" style label, per the plain-numbers voice law. */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
