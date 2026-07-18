import type { MapScores } from "./scoring";

/**
 * The report lock (plans/2026-07-18-report-lock.md): with
 * HOMA_REPORT_LOCK_ENABLED on, a walled family's report renders four
 * subjects in full and holds the rest for membership. This module owns
 * the one judgment call: WHICH four render open.
 *
 * Policy, founder-ruled 2026-07-18: a fixed core (math, literacy,
 * science, social-emotional), not the child's strongest four. The
 * strongest-four tease reads as "the hidden subjects are the weak
 * ones", which brushes the anti-guilt law even with clean copy; a
 * fixed core makes the open set about the subjects parents ask about
 * first, never about this child's ranking.
 *
 * Honesty rules encoded here:
 * - Only MAPPED subjects are ever locked. A not-mapped subject has no
 *   scored content to hold back; locking it would sell an empty row.
 * - When a core subject is not mapped for this child, its slot is
 *   filled from strengthOrder (the report's own mapped ordering), so
 *   the free four are always four real, fully scored rows when the
 *   child has four to give.
 * - A report with four or fewer mapped subjects renders fully open:
 *   freeReportSubjects returns every mapped id and the caller finds
 *   nothing left to lock. Walling a nearly empty report is theater.
 */

export const REPORT_LOCK_FREE_COUNT = 4;

/** Parent-facing vocabulary note: surfaces built on this module say
 *  "report" or "progress", never "map" (founder ruling 2026-07-18). */
export const REPORT_LOCK_CORE_SUBJECTS = [
  "math",
  "literacy",
  "science",
  "social_emotional",
] as const;

/**
 * The subject ids that render OPEN under the report lock, in no
 * particular order (render order stays the report's own). Pure and
 * deterministic: same scores in, same four out.
 */
export function freeReportSubjects(scores: MapScores): string[] {
  const mapped = new Set(
    scores.subjects
      .filter((subject) => subject.position !== "not_mapped")
      .map((subject) => subject.subjectId),
  );

  const free: string[] = [];
  for (const id of REPORT_LOCK_CORE_SUBJECTS) {
    if (free.length >= REPORT_LOCK_FREE_COUNT) break;
    if (mapped.has(id)) free.push(id);
  }
  for (const id of scores.strengthOrder) {
    if (free.length >= REPORT_LOCK_FREE_COUNT) break;
    if (mapped.has(id) && !free.includes(id)) free.push(id);
  }
  return free;
}

/**
 * The mapped subject ids the lock holds back for this child: mapped,
 * not in the free four. Empty means the lock has nothing to do and the
 * report renders open with no offer card.
 */
export function lockedReportSubjects(scores: MapScores): string[] {
  const free = new Set(freeReportSubjects(scores));
  return scores.subjects
    .filter((subject) => subject.position !== "not_mapped" && !free.has(subject.subjectId))
    .map((subject) => subject.subjectId);
}
