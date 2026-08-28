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
  // Added 2026-08-28: the one Hours subject that maps 1:1 onto the real
  // progress-report taxonomy (packages/core/src/map/content.ts's
  // "spanish", displayed there as "Second language" too), so a family's
  // logged time can appear next to that subject's actual skill evidence.
  // The other nine subjects above are deliberately left as Hours' own
  // coarser vocabulary: several of them (reading in particular) span
  // multiple real taxonomy subjects and don't have one honest home, and
  // reconciling those is separately scoped, not assumed here.
  "spanish",
] as const;

export type HoursSubject = (typeof HOURS_SUBJECTS)[number];

export function isHoursSubject(value: string): value is HoursSubject {
  return (HOURS_SUBJECTS as readonly string[]).includes(value);
}
