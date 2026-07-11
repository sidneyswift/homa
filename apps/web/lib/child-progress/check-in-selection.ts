import {
  buildMapQuestionQueue,
  getMapItem,
  planQuestions,
  type MapAnswer,
  type MapItem,
  type MapQuestionPlan,
} from "@homa/core";

import { isProgressEvidenceAnswer } from "./evidence-policy";
import type {
  ProgressSelectionAnswer,
  ProgressSelectionInput,
} from "./types";

export const AGENT_CHECK_IN_EXCLUDED_ITEM_IDS: ReadonlySet<string> =
  new Set(["math.skip-counting"]);

interface SubjectEvidenceSummary {
  realObservationCount: number;
  latestEvidenceAtEpochMs: number | null;
}

interface RefreshCandidate {
  item: MapItem;
  subjectId: string;
  evidenceAtEpochMs: number | null;
}

interface TimedProgressSelectionAnswer extends ProgressSelectionAnswer {
  answeredAtEpochMs: number;
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

function compareOptionalEpochMs(
  left: number | null,
  right: number | null,
): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return left - right;
}

function parseSelectionAnswerTimestamps(
  answers: readonly ProgressSelectionAnswer[],
): TimedProgressSelectionAnswer[] {
  return answers.map((answer) => {
    const answeredAtEpochMs = Date.parse(answer.answeredAt);
    if (!Number.isFinite(answeredAtEpochMs)) {
      throw new TypeError(
        `Invalid answeredAt "${answer.answeredAt}" for evidence "${answer.evidenceId}"`,
      );
    }
    return { ...answer, answeredAtEpochMs };
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
      answer.answeredAtEpochMs > current.answeredAtEpochMs ||
      (answer.answeredAtEpochMs === current.answeredAtEpochMs &&
        compareStableIds(answer.evidenceId, current.evidenceId) > 0)
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
      latestEvidenceAtEpochMs: null,
    };
    summary.realObservationCount += 1;
    if (
      summary.latestEvidenceAtEpochMs === null ||
      answer.answeredAtEpochMs > summary.latestEvidenceAtEpochMs
    ) {
      summary.latestEvidenceAtEpochMs = answer.answeredAtEpochMs;
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
  latestEvidenceAtByItem: ReadonlyMap<string, number>,
): RefreshCandidate[] {
  const candidates: RefreshCandidate[] = [];
  for (const plan of plans) {
    for (const item of [plan.base, ...plan.ladders]) {
      const response = latestByItem.get(item.id);
      if (response === undefined) break;
      candidates.push({
        item,
        subjectId: plan.subjectId,
        evidenceAtEpochMs: latestEvidenceAtByItem.get(item.id) ?? null,
      });
      if (response.answer !== "easily") break;
    }
  }
  return candidates;
}

function buildLatestEvidenceAtByItem(
  answers: readonly TimedProgressSelectionAnswer[],
): Map<string, number> {
  const latestEvidenceAtByItem = new Map<string, number>();
  for (const answer of answers) {
    if (!isProgressEvidenceAnswer(answer.answer)) continue;
    const current = latestEvidenceAtByItem.get(answer.itemId);
    if (current === undefined || answer.answeredAtEpochMs > current) {
      latestEvidenceAtByItem.set(
        answer.itemId,
        answer.answeredAtEpochMs,
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
      compareOptionalEpochMs(
        subjectEvidence.get(left.subjectId)?.latestEvidenceAtEpochMs ??
          null,
        subjectEvidence.get(right.subjectId)?.latestEvidenceAtEpochMs ??
          null,
      ) ||
      compareStableIds(left.item.id, right.item.id),
  );
  if (unanswered[0] !== undefined) return unanswered[0].item;

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
      compareOptionalEpochMs(
        left.evidenceAtEpochMs,
        right.evidenceAtEpochMs,
      ) ||
      compareStableIds(left.item.id, right.item.id),
  );
  return refreshCandidates[0]?.item ?? null;
}
