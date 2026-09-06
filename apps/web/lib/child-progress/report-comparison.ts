import { isDeepStrictEqual } from "node:util";

import { MAP_BANK_VERSION, MAP_SCORER_VERSION, scoreMap, type MapAnswerInput } from "@homa/core";

import { zonedDateString } from "../time-zone";
import {
  buildProgressComparison,
  canonicalComparisonAnswers,
  progressComparisonAge,
  type ProgressComparison,
} from "./comparison";
import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";
import { CHILD_PROGRESS_PROJECTION_VERSION, childProgressViewSchema } from "./view-schema";

export type ReportComparisons =
  | { status: "unavailable" }
  | { status: "available"; timeZone: string; subjects: ProgressComparison[]; answers: MapAnswerInput[] };

export interface SavedReportProjection {
  childId: string;
  scores: unknown;
  generatedAt: string;
  bankVersion: string;
  scorerVersion: string | null;
  scoredBirthDate: string | null;
  scoredAgeMonths: number | null;
  projection: unknown;
  projectionBankVersion: string | null;
  projectionVersion: string | null;
  projectionDate: string | null;
  projectedAt: string | null;
}

/** A report explains its saved scoring, never today's live reading. The
 * token-scoped query joins only a projection saved with this report; verify
 * that complete measurement basis again before exposing evidence or numbers. */
export function buildSavedReportComparisons(input: SavedReportProjection): ReportComparisons {
  const unavailable = { status: "unavailable" } as const;
  try {
    if (input.bankVersion !== MAP_BANK_VERSION || input.scorerVersion !== MAP_SCORER_VERSION
      || input.projectionBankVersion !== input.bankVersion
      || input.projectionVersion !== CHILD_PROGRESS_PROJECTION_VERSION
      || input.projectedAt === null) return unavailable;
    const parsed = childProgressViewSchema.safeParse(input.projection);
    if (!parsed.success) return unavailable;
    const view = parsed.data;
    const answers = canonicalComparisonAnswers(view);
    const reportInstant = parseOffsetIsoTimestampEpochNanoseconds(input.generatedAt);
    if (view.childId !== input.childId || view.birthDate !== input.scoredBirthDate
      || parseOffsetIsoTimestampEpochNanoseconds(input.projectedAt) !== reportInstant
      || parseOffsetIsoTimestampEpochNanoseconds(view.projectedAt) !== reportInstant
      || zonedDateString(new Date(view.projectedAt), view.timeZone) !== input.projectionDate
      || progressComparisonAge(view) !== input.scoredAgeMonths
      || !isDeepStrictEqual(view.scores, input.scores)
      || !isDeepStrictEqual(scoreMap(progressComparisonAge(view), answers), view.scores)) return unavailable;
    const subjects = view.scores.subjects.map(score => buildProgressComparison(view, score.subjectId));
    if (subjects.some(subject => subject.status === "unavailable")) return unavailable;
    return { status: "available", timeZone: view.timeZone, subjects, answers };
  } catch {
    return unavailable;
  }
}
