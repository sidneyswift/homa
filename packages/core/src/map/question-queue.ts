import {
  planQuestions,
  type MapAnswer,
  type MapItem,
  type MapQuestionPlan,
} from "./bank";

export interface MapQueueEntry {
  subjectId: string;
  item: MapItem;
  isLadder: boolean;
}

/**
 * Builds the adaptive checklist queue. A subject starts at its age-plan base
 * and climbs one rung at a time only while every saved answer is "easily".
 */
export function buildMapQuestionQueue(
  plans: readonly MapQuestionPlan[],
  answers: Readonly<Record<string, MapAnswer>>,
): MapQueueEntry[] {
  const queue: MapQueueEntry[] = [];
  for (const plan of plans) {
    const baseAnswer = answers[plan.base.id];
    if (baseAnswer === undefined) {
      queue.push({
        subjectId: plan.subjectId,
        item: plan.base,
        isLadder: false,
      });
      continue;
    }
    if (baseAnswer !== "easily") continue;

    // Only the first unanswered rung is askable, and any other answer ends
    // the climb. This preserves the onboarding questionnaire's exact pacing.
    for (const rung of plan.ladders) {
      const rungAnswer = answers[rung.id];
      if (rungAnswer === undefined) {
        queue.push({
          subjectId: plan.subjectId,
          item: rung,
          isLadder: true,
        });
        break;
      }
      if (rungAnswer !== "easily") break;
    }
  }
  return queue;
}

/** True when a child has started and no age-plan question remains to ask. */
export function isMapChecklistComplete(child: {
  ageMonths: number;
  answers: Readonly<Record<string, MapAnswer>>;
  answered: number;
}): boolean {
  if (child.answered === 0) return false;
  return (
    buildMapQuestionQueue(
      planQuestions(child.ageMonths),
      child.answers,
    ).length === 0
  );
}
