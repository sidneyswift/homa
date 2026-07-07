import { planQuestions, type MapAnswer, type MapItem } from "@homa/core";

import type { FlowChild } from "./flow-types";

/**
 * The adaptive question queue, shared by the checklist (which walks it) and
 * the flow router (which needs "is this child's questionnaire actually
 * finished?" to resume a fully-answered child straight at signup/scoring
 * instead of dumping them on the hub, e.g. right after a Google sign-in
 * redirect).
 */

export interface QueueEntry {
  domainId: string;
  item: MapItem;
  isLadder: boolean;
}

export function buildQueue(
  plans: ReturnType<typeof planQuestions>,
  answers: Record<string, MapAnswer>,
): QueueEntry[] {
  const queue: QueueEntry[] = [];
  for (const plan of plans) {
    const baseAnswer = answers[plan.base.id];
    if (baseAnswer === undefined) {
      queue.push({ domainId: plan.domainId, item: plan.base, isLadder: false });
      continue;
    }
    if (baseAnswer !== "easily") continue;
    // Climb the ladder while the answers stay "easily"; the first unanswered
    // rung is the next question, and any other answer ends the climb.
    for (const rung of plan.ladders) {
      const rungAnswer = answers[rung.id];
      if (rungAnswer === undefined) {
        queue.push({ domainId: plan.domainId, item: rung, isLadder: true });
        break;
      }
      if (rungAnswer !== "easily") break;
    }
  }
  return queue;
}

/** True when the child has started and no question remains to ask. */
export function isChecklistComplete(child: FlowChild): boolean {
  if (child.answered === 0) return false;
  const plans = planQuestions(child.ageMonths);
  return buildQueue(plans, child.answers).length === 0;
}
