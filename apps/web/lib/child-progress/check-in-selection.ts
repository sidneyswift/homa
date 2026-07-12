import {
  buildMapQuestionQueue,
  getMapItem,
  planQuestions,
  type MapAnswer,
  type MapItem,
  type MapQuestionPlan,
} from "@homa/core";

import { isProgressEvidenceAnswer } from "./evidence-policy";
import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";
import type {
  ProgressSelectionAnswer,
  ProgressSelectionInput,
} from "./types";

export const AGENT_CHECK_IN_EXCLUDED_ITEM_IDS: ReadonlySet<string> =
  new Set([
    "math.skip-counting",
    "literacy.reads-short-book",
    "literacy.chapter-books",
  ]);

interface SubjectEvidenceSummary {
  realObservationCount: number;
  latestEvidenceAtEpochNanoseconds: bigint | null;
}

interface RefreshCandidate {
  item: MapItem;
  subjectId: string;
  evidenceAtEpochNanoseconds: bigint | null;
}

interface TimedProgressSelectionAnswer extends ProgressSelectionAnswer {
  answeredAtEpochNanoseconds: bigint;
}

function compareStableIds(left: string, right: string): number {
  const leftCodePoints = Array.from(left, (character) =>
    character.codePointAt(0) ?? 0
  );
  const rightCodePoints = Array.from(right, (character) =>
    character.codePointAt(0) ?? 0
  );
  const sharedLength = Math.min(
    leftCodePoints.length,
    rightCodePoints.length,
  );
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftCodePoints[index] - rightCodePoints[index];
    if (difference !== 0) return difference;
  }
  return leftCodePoints.length - rightCodePoints.length;
}

function compareOptionalEpochNanoseconds(
  left: bigint | null,
  right: bigint | null,
): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return left < right ? -1 : 1;
}

function parseSelectionAnswerTimestamps(
  answers: readonly ProgressSelectionAnswer[],
): TimedProgressSelectionAnswer[] {
  return answers.map((answer) => {
    let answeredAtEpochNanoseconds: bigint;
    try {
      answeredAtEpochNanoseconds =
        parseOffsetIsoTimestampEpochNanoseconds(
          answer.answeredAt,
        );
    } catch {
      throw new TypeError(
        `Invalid answeredAt "${answer.answeredAt}" for selection "${answer.selectionId}"`,
      );
    }
    return { ...answer, answeredAtEpochNanoseconds };
  });
}

function buildLatestResponseByItem(
  answers: readonly TimedProgressSelectionAnswer[],
): Map<string, TimedProgressSelectionAnswer> {
  const latestByItem = new Map<string, TimedProgressSelectionAnswer>();
  for (const answer of answers) {
    const current = latestByItem.get(answer.itemId);
    if (
      current === undefined ||
      answer.answeredAtEpochNanoseconds >
        current.answeredAtEpochNanoseconds ||
      (answer.answeredAtEpochNanoseconds ===
        current.answeredAtEpochNanoseconds &&
        compareStableIds(answer.selectionId, current.selectionId) > 0)
    ) {
      latestByItem.set(answer.itemId, answer);
    }
  }
  return latestByItem;
}

function buildLatestAnswerRecord(
  latestByItem: ReadonlyMap<string, ProgressSelectionAnswer>,
): Record<string, MapAnswer> {
  const answerRecord: Record<string, MapAnswer> = {};
  for (const [itemId, answer] of latestByItem) {
    answerRecord[itemId] = answer.answer;
  }
  return answerRecord;
}

function buildAgentEligiblePlans(
  ageMonths: number,
  subjectIds: readonly string[] | undefined,
): MapQuestionPlan[] {
  const subjectScope =
    subjectIds === undefined ? null : new Set(subjectIds);

  return planQuestions(ageMonths).flatMap((plan) => {
    if (subjectScope !== null && !subjectScope.has(plan.subjectId)) {
      return [];
    }
    const ladders = plan.ladders.filter(
      (item) => !AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(item.id),
    );
    if (!AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(plan.base.id)) {
      return [{ subjectId: plan.subjectId, base: plan.base, ladders }];
    }

    const subject = getMapItem(plan.base.id)?.subject;
    const base = subject?.items
      .filter(
        (item) =>
          item.typicalMonths <= plan.base.typicalMonths &&
          !AGENT_CHECK_IN_EXCLUDED_ITEM_IDS.has(item.id),
      )
      .sort(
        (left, right) =>
          right.typicalMonths - left.typicalMonths ||
          compareStableIds(left.id, right.id),
      )[0];
    if (base === undefined) return [];
    return [{ subjectId: plan.subjectId, base, ladders }];
  });
}

function summarizeSubjectEvidence(
  answers: readonly TimedProgressSelectionAnswer[],
): Map<string, SubjectEvidenceSummary> {
  const summaries = new Map<string, SubjectEvidenceSummary>();
  for (const answer of answers) {
    if (!isProgressEvidenceAnswer(answer.answer)) continue;
    const bankEntry = getMapItem(answer.itemId);
    if (bankEntry === undefined) continue;

    const summary = summaries.get(bankEntry.subject.id) ?? {
      realObservationCount: 0,
      latestEvidenceAtEpochNanoseconds: null,
    };
    summary.realObservationCount += 1;
    if (
      summary.latestEvidenceAtEpochNanoseconds === null ||
      answer.answeredAtEpochNanoseconds >
        summary.latestEvidenceAtEpochNanoseconds
    ) {
      summary.latestEvidenceAtEpochNanoseconds =
        answer.answeredAtEpochNanoseconds;
    }
    summaries.set(bankEntry.subject.id, summary);
  }
  return summaries;
}

function compareSubjectCoveragePriority(
  leftSubjectId: string,
  rightSubjectId: string,
  summaries: ReadonlyMap<string, SubjectEvidenceSummary>,
): number {
  const left = summaries.get(leftSubjectId);
  const right = summaries.get(rightSubjectId);
  const leftNeedsCoverage = (left?.realObservationCount ?? 0) < 2;
  const rightNeedsCoverage = (right?.realObservationCount ?? 0) < 2;
  if (leftNeedsCoverage !== rightNeedsCoverage) {
    return leftNeedsCoverage ? -1 : 1;
  }
  return 0;
}

function collectAnsweredEligibleItems(
  plans: readonly MapQuestionPlan[],
  latestByItem: ReadonlyMap<string, ProgressSelectionAnswer>,
  latestEvidenceAtByItem: ReadonlyMap<string, bigint>,
): RefreshCandidate[] {
  const candidates: RefreshCandidate[] = [];
  for (const plan of plans) {
    for (const item of [plan.base, ...plan.ladders]) {
      const response = latestByItem.get(item.id);
      if (response === undefined) break;
      candidates.push({
        item,
        subjectId: plan.subjectId,
        evidenceAtEpochNanoseconds:
          latestEvidenceAtByItem.get(item.id) ?? null,
      });
      if (response.answer !== "easily") break;
    }
  }
  return candidates;
}

function buildLatestEvidenceAtByItem(
  answers: readonly TimedProgressSelectionAnswer[],
): Map<string, bigint> {
  const latestEvidenceAtByItem = new Map<string, bigint>();
  for (const answer of answers) {
    if (!isProgressEvidenceAnswer(answer.answer)) continue;
    const current = latestEvidenceAtByItem.get(answer.itemId);
    if (
      current === undefined ||
      answer.answeredAtEpochNanoseconds > current
    ) {
      latestEvidenceAtByItem.set(
        answer.itemId,
        answer.answeredAtEpochNanoseconds,
      );
    }
  }
  return latestEvidenceAtByItem;
}

export function selectNextProgressItem(
  input: ProgressSelectionInput,
): MapItem | null {
  const plans = buildAgentEligiblePlans(
    input.ageMonths,
    input.subjectIds,
  );
  const timedAnswers = parseSelectionAnswerTimestamps(input.answers);
  const latestByItem = buildLatestResponseByItem(timedAnswers);
  const answerRecord = buildLatestAnswerRecord(latestByItem);
  const subjectEvidence = summarizeSubjectEvidence(timedAnswers);

  // Ranking happens in stages so an answered item can never outrank a new
  // age-plan question. Coverage under two real observations comes next,
  // followed by evidence age and a stable item ID tie-break.
  const unanswered = buildMapQuestionQueue(plans, answerRecord).sort(
    (left, right) =>
      compareSubjectCoveragePriority(
        left.subjectId,
        right.subjectId,
        subjectEvidence,
      ) ||
      compareOptionalEpochNanoseconds(
        subjectEvidence.get(left.subjectId)
          ?.latestEvidenceAtEpochNanoseconds ?? null,
        subjectEvidence.get(right.subjectId)
          ?.latestEvidenceAtEpochNanoseconds ?? null,
      ) ||
      compareStableIds(left.item.id, right.item.id),
  );
  if (unanswered[0] !== undefined) return unanswered[0].item;
  if (input.allowRefresh === false) return null;

  const refreshCandidates = collectAnsweredEligibleItems(
    plans,
    latestByItem,
    buildLatestEvidenceAtByItem(timedAnswers),
  ).sort(
    (left, right) =>
      compareSubjectCoveragePriority(
        left.subjectId,
        right.subjectId,
        subjectEvidence,
      ) ||
      compareOptionalEpochNanoseconds(
        left.evidenceAtEpochNanoseconds,
        right.evidenceAtEpochNanoseconds,
      ) ||
      compareStableIds(left.item.id, right.item.id),
  );
  return refreshCandidates[0]?.item ?? null;
}
