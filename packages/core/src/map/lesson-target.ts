import {
  getMapSubject,
  MAP_BANK_VERSION,
  type MapAnswer,
  type MapItem,
  type MapSubject,
} from "./bank";
import { scoreMap, type MapAnswerInput } from "./scoring";

export interface SubjectLessonTarget {
  targetItemId: string | null;
  targetStatement: string;
  startingLine: string | null;
  determinantAnswers: Array<{ itemId: string; answer: MapAnswer }>;
  bankVersion: string;
}

interface SubjectTargetSelection {
  domain: MapSubject;
  startingLine: string | null;
  targetItems: MapItem[];
  determinantAnswers: Array<{ itemId: string; answer: MapAnswer }>;
}

/**
 * Walks the reviewed subject ladder once so lessons and legacy plans share
 * exactly the same floor and target rules.
 */
function selectSubjectTargetItems(
  subjectId: string,
  ageMonths: number,
  answers: MapAnswerInput[]
): SubjectTargetSelection | null {
  const domain = getMapSubject(subjectId);
  if (!domain) return null;

  const score = scoreMap(ageMonths, answers).subjects.find(
    (entry) => entry.subjectId === subjectId
  );
  const answered = new Map(
    answers.map((entry) => [entry.itemId, entry.answer])
  );
  const sorted = [...domain.items].sort(
    (left, right) =>
      left.typicalMonths - right.typicalMonths
      || left.id.localeCompare(right.id),
  );

  // Nothing below the highest confirmed anchor should become a target.
  let effectiveConfirmation: {
    item: MapItem;
    answer: Extract<MapAnswer, "easily" | "getting_there">;
    floorMonths: number;
  } | null = null;
  let lowestNotYet: MapItem | null = null;
  for (const item of sorted) {
    const answer = answered.get(item.id);
    if (answer === "easily" || answer === "getting_there") {
      const floorMonths =
        answer === "easily" ? item.typicalMonths : item.typicalMonths - 6;
      if (
        effectiveConfirmation === null
        || floorMonths > effectiveConfirmation.floorMonths
        || (
          floorMonths === effectiveConfirmation.floorMonths
          && (
            item.typicalMonths > effectiveConfirmation.item.typicalMonths
            || (
              item.typicalMonths
                === effectiveConfirmation.item.typicalMonths
              && item.id < effectiveConfirmation.item.id
            )
          )
        )
      ) {
        effectiveConfirmation = { item, answer, floorMonths };
      }
    }
    if (
      answer === "not_yet"
      && (
        lowestNotYet === null
        || item.typicalMonths < lowestNotYet.typicalMonths
        || (
          item.typicalMonths === lowestNotYet.typicalMonths
          && item.id < lowestNotYet.id
        )
      )
    ) {
      lowestNotYet = item;
    }
  }
  const determinantAnswers =
    effectiveConfirmation
      ? [{
          itemId: effectiveConfirmation.item.id,
          answer: effectiveConfirmation.answer,
        }]
      : lowestNotYet
      ? [{ itemId: lowestNotYet.id, answer: "not_yet" as const }]
      : [];

  // With nothing confirmed, use the named not-yet item as the floor instead
  // of sending an older child back to the bottom of the bank.
  const floor = effectiveConfirmation
    ? effectiveConfirmation.floorMonths
    : lowestNotYet !== null
    ? lowestNotYet.typicalMonths - 1
    : -Infinity;

  // Keep two rungs for legacy plans. A lesson consumes only the first one.
  const targetItems: MapItem[] = [];
  for (const item of sorted) {
    if (targetItems.length >= 2) break;
    if (answered.get(item.id) === "easily") continue;
    if (item.typicalMonths <= floor) continue;
    targetItems.push(item);
  }

  return {
    domain,
    startingLine: score?.strongestObservedStatement ?? null,
    targetItems,
    determinantAnswers,
  };
}

function subjectDepthTarget(domain: MapSubject): string {
  // Once every reviewed rung is confirmed, offer depth instead of inventing
  // a benchmark beyond the reviewed bank.
  return `Going wider in ${domain.displayName.toLowerCase()}: past every benchmark on file`;
}

/**
 * Selects one reviewed next-skill target for a durable subject lesson.
 */
export function selectSubjectLessonTarget(
  subjectId: string,
  ageMonths: number,
  answers: MapAnswerInput[]
): SubjectLessonTarget | null {
  const selection = selectSubjectTargetItems(subjectId, ageMonths, answers);
  if (!selection) return null;

  const targetItem = selection.targetItems[0] ?? null;
  return {
    targetItemId: targetItem?.id ?? null,
    targetStatement:
      targetItem?.statement ?? subjectDepthTarget(selection.domain),
    startingLine: selection.startingLine,
    determinantAnswers: selection.determinantAnswers,
    bankVersion: MAP_BANK_VERSION,
  };
}

/**
 * Preserves the two-target walk consumed by existing four-week plans.
 */
export function selectSubjectPlanTargets(
  subjectId: string,
  ageMonths: number,
  answers: MapAnswerInput[]
): { startingLine: string | null; targets: string[] } | null {
  const selection = selectSubjectTargetItems(subjectId, ageMonths, answers);
  if (!selection) return null;

  const targets = selection.targetItems.map((item) => item.statement);
  if (targets.length === 0) {
    targets.push(subjectDepthTarget(selection.domain));
  }
  return { startingLine: selection.startingLine, targets };
}
