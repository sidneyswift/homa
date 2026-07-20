import type { MapScores } from "@homa/core";

/**
 * Duplicate-scoring detection for createReport. Production evidence
 * 2026-07-18: POST /api/map/score landed twice per child scoring in two
 * independent sessions (map.report_generated pairs 0.09s to 0.72s
 * apart; a mid-beat page refresh or a second page context re-runs the
 * scoring step's mount effect). Each duplicate pushed a same-numbers
 * snapshot into history, reset the in-flight narrative claim (a second
 * model call), and re-emitted the generated event.
 *
 * A second scoring is a duplicate submission, not a rescore, when it
 * would write exactly the numbers the row already holds, under the same
 * ruler (bank, scorer, age), moments after the row was written. A real
 * rescore follows new answers (a deep dive, a correction), which takes
 * minutes and changes the scores; the founder's regenerate-on-every-
 * rescore ruling is untouched because a duplicate regenerates nothing
 * new, it re-runs the identical generation.
 */

/** Wide enough for every observed duplicate (well under a second) and a
 * slow reload; far under the minutes a real rescore takes to produce. */
export const DUPLICATE_SCORING_WINDOW_MS = 30_000;

export interface PriorScoring {
  scores: MapScores;
  /** Milliseconds since the row's generated_at, computed by the
   * database clock (never parsed from timestamp text). */
  generatedAgeMs: number;
  bankVersion: string;
  scorerVersion: string | null;
  scoredAgeMonths: number | null;
}

export interface NextScoring {
  scores: MapScores;
  bankVersion: string;
  scorerVersion: string;
  ageMonths: number;
}

/** Structural equality over JSON values. jsonb does not preserve object
 * key order, so the stored scores and a fresh scoreMap result never
 * stringify identically even when equal. */
export function jsonDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => jsonDeepEqual(item, b[index]));
  }
  if (
    typeof a === "object" && a !== null && !Array.isArray(a) &&
    typeof b === "object" && b !== null && !Array.isArray(b)
  ) {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        jsonDeepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
      )
    );
  }
  return false;
}

export function isDuplicateScoring(prior: PriorScoring, next: NextScoring): boolean {
  if (prior.bankVersion !== next.bankVersion) return false;
  if (prior.scorerVersion !== next.scorerVersion) return false;
  if (prior.scoredAgeMonths !== next.ageMonths) return false;
  if (!Number.isFinite(prior.generatedAgeMs)) return false;
  if (Math.abs(prior.generatedAgeMs) > DUPLICATE_SCORING_WINDOW_MS) return false;
  return jsonDeepEqual(prior.scores, next.scores);
}
