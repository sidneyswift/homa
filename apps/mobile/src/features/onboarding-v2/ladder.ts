/**
 * The 16-subject questionnaire, walking @homa/core's real content bank.
 *
 * planQuestions(ageMonths) already returns, per subject, the age-correct
 * base item plus climbable upward rungs (bank.ts's own frontier logic,
 * real and age-verified, not reinvented here). What it does not give is a
 * downward rung: the council review's "guaranteed floor" finding (a mother
 * whose child is not yet at the age-typical item must still see one thing
 * her child does, never sixteen bare Not yets) requires reaching one item
 * BELOW the base, which bank.ts's own law calls "deliberately impossible"
 * for the main ladder (bank.ts:11-12) because it only ever served the
 * upward case. This file adds exactly one capped downward step, sourced
 * from the same MAP_SUBJECTS content, and stops there. No new content, no
 * change to bank.ts.
 */
import {
  MAP_SUBJECTS,
  planQuestions,
  type MapAnswer,
  type MapItem,
  type MapQuestionPlan,
} from "@homa/core";

export interface LadderStep {
  subjectId: string;
  subjectDisplayName: string;
  subjectIntro: string;
  item: MapItem;
  kind: "base" | "down" | "up";
}

interface SubjectCursor {
  phase: "base" | "maybe-down" | "down" | "climb" | "done";
  rung: number; // index into plan.ladders, once climbing
}

function itemsBelowBase(subjectId: string, base: MapItem): MapItem[] {
  const domain = MAP_SUBJECTS.find((subject) => subject.id === subjectId);
  if (!domain) return [];
  const sorted = [...domain.items].sort((a, b) => a.typicalMonths - b.typicalMonths);
  return sorted.filter((item) => item.typicalMonths < base.typicalMonths).reverse();
}

/** Builds the ordered per-subject plan once. Pure, cheap, no I/O. */
export function buildLadderPlans(ageMonths: number): MapQuestionPlan[] {
  return planQuestions(ageMonths);
}

/**
 * A tiny pure state machine: given the plans, the subject index, that
 * subject's cursor, and the answer just given, returns the next thing to
 * show (a step in the SAME subject, or null meaning "advance to the next
 * subject"). One downward rung ever, one climb ever, matching the
 * council's "guaranteed floor, then an optional climb" recommendation.
 */
export function stepFor(
  plans: MapQuestionPlan[],
  subjectIndex: number,
  cursor: SubjectCursor,
): LadderStep | null {
  const plan = plans[subjectIndex];
  if (!plan) return null;
  const domain = MAP_SUBJECTS[subjectIndex];
  const base: LadderStep = {
    subjectId: plan.subjectId,
    subjectDisplayName: domain.displayName,
    subjectIntro: domain.intro,
    item: plan.base,
    kind: "base",
  };
  if (cursor.phase === "base") return base;
  if (cursor.phase === "down") {
    const below = itemsBelowBase(plan.subjectId, plan.base);
    const item = below[0];
    if (!item) return null;
    return { ...base, item, kind: "down" };
  }
  if (cursor.phase === "climb") {
    const item = plan.ladders[cursor.rung];
    if (!item) return null;
    return { ...base, item, kind: "up" };
  }
  return null;
}

/** After an answer, decide the subject's next cursor phase. */
export function advanceCursor(
  plans: MapQuestionPlan[],
  subjectIndex: number,
  cursor: SubjectCursor,
  answer: MapAnswer,
): SubjectCursor {
  const plan = plans[subjectIndex];
  if (!plan) return { phase: "done", rung: 0 };
  if (cursor.phase === "base") {
    if (answer === "not_yet") {
      const below = itemsBelowBase(plan.subjectId, plan.base);
      return below.length > 0 ? { phase: "down", rung: 0 } : { phase: "done", rung: 0 };
    }
    if (answer === "easily" && plan.ladders.length > 0) {
      return { phase: "climb", rung: 0 };
    }
    return { phase: "done", rung: 0 };
  }
  if (cursor.phase === "down") return { phase: "done", rung: 0 };
  if (cursor.phase === "climb") {
    if (answer === "easily" && cursor.rung + 1 < plan.ladders.length) {
      return { phase: "climb", rung: cursor.rung + 1 };
    }
    return { phase: "done", rung: 0 };
  }
  return { phase: "done", rung: 0 };
}

export const INITIAL_CURSOR: SubjectCursor = { phase: "base", rung: 0 };
export type { SubjectCursor };
