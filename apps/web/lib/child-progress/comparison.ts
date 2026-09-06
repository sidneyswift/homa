import {
  ageInMonths, getMapItem, getMapSubject, getScorableItem, MAP_BANK_VERSION,
  MAP_SCORER_VERSION, MAP_SOURCES, scoreMap, type MapAnswerInput,
} from "@homa/core";
import { curricula, getTopic, standardsForTopic } from "@homa/taxonomy";
import { zonedDateString } from "../time-zone";
import { progressEvidenceDerivationLabel, progressSourceLabel } from "./view-copy";
import type { ChildProgressView, ProgressTopicView } from "./types";

export const MAX_COMPARISON_BASIS = 4;
export interface ComparisonBasis {
  itemId: string;
  statement: string;
  answer: "easily" | "getting_there";
  observedAt: string;
  source: string;
  derivation: string;
  derivationLabel: string;
  creditedAgeMonths: number;
  typicalAgeMonths: number;
  typicalWindowMonths: readonly [number, number] | null;
  kind: "milestone_or_standard" | "teaching_window";
  citations: { label: string; url: string | null }[];
  standards: string[];
}
export interface ProgressComparison {
  subjectId: string;
  status: "measured" | "unknown" | "exposure" | "no_frontier" | "unavailable";
  projectedAt: string;
  ageMonths: number;
  monthsAhead: number | null;
  frontierDeltaMonths: number | null;
  beyondScale: boolean;
  limitReason: "display_cap" | "checklist_ceiling" | null;
  displayLabel: string | null;
  observations: number;
  openConflicts: number;
  basis: ComparisonBasis[];
  basisCount: number;
  omittedBasisCount: number;
  bankVersion: string;
  scorerVersion: string;
}

/** Use the same family-local calendar date as buildChildProgressView. */
export function progressComparisonAge(view: ChildProgressView): number {
  const date = zonedDateString(new Date(view.projectedAt), view.timeZone);
  return ageInMonths(view.birthDate, new Date(`${date}T12:00:00.000Z`));
}

export function effectiveComparisonTopics(view: ChildProgressView): ProgressTopicView[] {
  return view.subjects.flatMap(subject => subject.domains.flatMap(domain => domain.topics))
    .filter(topic => (topic.state === "observed_today" || topic.state === "older") && getScorableItem(topic.itemId));
}

export function canonicalComparisonAnswers(view: ChildProgressView): MapAnswerInput[] {
  return effectiveComparisonTopics(view).flatMap(topic => topic.answer === null ? [] : [{ itemId: topic.itemId, answer: topic.answer }]);
}

/** Saved answers are distinct from the bounded winning basis and catalog
 * ladder. Preserve lower-credit and Not yet answers without guessing credit. */
export function buildSubjectAnswerInventory(view: ChildProgressView, subjectId: string) {
  const ageMonths = progressComparisonAge(view);
  const topics = effectiveComparisonTopics(view).filter(topic => topic.answer !== null
    && getScorableItem(topic.itemId)?.subject.id === subjectId)
    .sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? "") || a.itemId.localeCompare(b.itemId, "en"));
  return {
    total: topics.length,
    omitted: Math.max(0, topics.length - 24),
    answers: topics.slice(0, 24).map(topic => {
      if (!topic.answer || !topic.source || !topic.observedAt) throw new Error("Missing saved answer provenance");
      const delta = scoreMap(ageMonths, [{ itemId: topic.itemId, answer: topic.answer }]).subjects
        .find(subject => subject.subjectId === subjectId)?.frontierDeltaMonths;
      return { itemId: topic.itemId, statement: topic.statement, answer: topic.answer,
        observedAt: topic.observedAt, source: progressSourceLabel(topic.source.kind),
        derivation: topic.source.derivation,
        derivationLabel: progressEvidenceDerivationLabel(topic.source.derivation),
        creditedAgeMonths: delta == null ? null : ageMonths + delta };
    }),
  };
}

function publicCitationUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function basisFor(topic: ProgressTopicView, creditedAgeMonths: number): ComparisonBasis {
  const found = getScorableItem(topic.itemId);
  if (!found || topic.answer === null || topic.answer === "not_yet" || !topic.source || !topic.observedAt) throw new Error("Missing credited evidence");
  const bank = getMapItem(topic.itemId);
  const standards = bank ? [...(bank.item.standards ?? [])] : standardsForTopic(topic.itemId).map(standard => standard.key);
  const topicRefs = new Set(getTopic(topic.itemId)?.refs ?? []);
  const citations = bank
    ? bank.item.sources.flatMap(key => MAP_SOURCES[key] ? [MAP_SOURCES[key]] : [])
    : curricula().filter(curriculum => curriculum.topics.some(standard => topicRefs.has(standard.key))).map(curriculum => ({ label: `${curriculum.name} (${curriculum.version})`, url: curriculum.sourceUrl }));
  return {
    itemId: topic.itemId, statement: topic.statement, answer: topic.answer,
    observedAt: topic.observedAt, source: progressSourceLabel(topic.source.kind),
    derivation: topic.source.derivation, derivationLabel: progressEvidenceDerivationLabel(topic.source.derivation),
    creditedAgeMonths, typicalAgeMonths: found.item.typicalMonths,
    typicalWindowMonths: found.item.typicalRangeMonths ?? null,
    kind: bank ? "milestone_or_standard" : "teaching_window",
    citations: citations.map(citation => ({ label: citation.label, url: publicCitationUrl(citation.url) })), standards,
  };
}

/** Web/chat read receipt. Scoring arithmetic remains exclusively in scoreMap.
 * A single-item replay identifies credited winners, not the largest raw anchor.
 * Raw family quotes and internal evidence IDs never enter this payload. */
export function buildProgressComparison(view: ChildProgressView, subjectId: string): ProgressComparison {
  const ageMonths = progressComparisonAge(view);
  const score = view.scores.subjects.find(entry => entry.subjectId === subjectId);
  const base: ProgressComparison = {
    subjectId, status: "unavailable", projectedAt: view.projectedAt, ageMonths,
    monthsAhead: null, frontierDeltaMonths: null, beyondScale: false, limitReason: null, displayLabel: null,
    observations: 0, openConflicts: view.conflicts.filter(conflict => getScorableItem(conflict.itemId)?.subject.id === subjectId).length,
    basis: [], basisCount: 0, omittedBasisCount: 0, bankVersion: MAP_BANK_VERSION, scorerVersion: MAP_SCORER_VERSION,
  };
  if (!score || !getMapSubject(subjectId)) return base;
  const answers = canonicalComparisonAnswers(view);
  const actual = scoreMap(ageMonths, answers).subjects.find(entry => entry.subjectId === subjectId);
  if (!actual || ["monthsAhead", "frontierDeltaMonths", "beyondScale", "observations", "position", "exposureBased"].some(key => actual[key as keyof typeof actual] !== score[key as keyof typeof score])) return base;
  const result = { ...base, observations: score.observations };
  if (score.exposureBased) return { ...result, status: "exposure" };
  if (score.position === "not_mapped") return { ...result, status: "unknown" };
  if (score.frontierDeltaMonths === null) return { ...result, status: "no_frontier" };
  const winners = effectiveComparisonTopics(view).filter(topic => {
    if (topic.answer !== "easily" && topic.answer !== "getting_there") return false;
    return scoreMap(ageMonths, [{ itemId: topic.itemId, answer: topic.answer }]).subjects
      .find(entry => entry.subjectId === subjectId)?.frontierDeltaMonths === score.frontierDeltaMonths;
  }).sort((left, right) => left.itemId.localeCompare(right.itemId, "en"));
  if (winners.length === 0) return base;
  return {
    ...result, status: "measured", monthsAhead: score.monthsAhead,
    frontierDeltaMonths: score.frontierDeltaMonths, beyondScale: score.beyondScale,
    // A truncated positive display proves a cap. Without truncation, the
    // scorer's only other beyondScale condition is a confirmed bank ceiling.
    limitReason: score.beyondScale
      ? score.monthsAhead !== null && score.frontierDeltaMonths > score.monthsAhead
        ? "display_cap" : "checklist_ceiling"
      : null,
    displayLabel: score.monthsAhead !== null && score.monthsAhead > 0
      ? `${score.beyondScale ? "At least" : "About"} ${score.monthsAhead} ${score.monthsAhead === 1 ? "month" : "months"} ahead`
      : null,
    basis: winners.slice(0, MAX_COMPARISON_BASIS).map(topic => basisFor(topic, ageMonths + score.frontierDeltaMonths!)),
    basisCount: winners.length, omittedBasisCount: Math.max(0, winners.length - MAX_COMPARISON_BASIS),
  };
}
