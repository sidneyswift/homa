import type { MapAnswer, MapAnswerInput, MapQuestionPlan } from "@homa/core";
import { advanceCursor, INITIAL_CURSOR, stepFor, type SubjectCursor } from "./ladder";

export interface QuestionPosition { subjectIndex: number; cursor: SubjectCursor }
export interface QuestionVisit extends QuestionPosition { answer: MapAnswer }
export interface QuestionSession extends QuestionPosition { history: QuestionVisit[]; selected: MapAnswer | null }

export function nextPosition(plans: MapQuestionPlan[], position: QuestionPosition, answer: MapAnswer): QuestionPosition | null {
  const cursor = advanceCursor(plans, position.subjectIndex, position.cursor, answer);
  if (cursor.phase !== "done") return { subjectIndex: position.subjectIndex, cursor };
  return position.subjectIndex + 1 < plans.length
    ? { subjectIndex: position.subjectIndex + 1, cursor: INITIAL_CURSOR }
    : null;
}

/** Resume at the first unanswered reachable question, or the final answer for review. */
export function resumeQuestions(plans: MapQuestionPlan[], answers: Record<string, MapAnswerInput>): QuestionSession {
  const history: QuestionVisit[] = [];
  let position: QuestionPosition = { subjectIndex: 0, cursor: INITIAL_CURSOR };
  while (true) {
    const step = stepFor(plans, position.subjectIndex, position.cursor);
    const answer = step ? answers[step.item.id]?.answer : undefined;
    if (answer === undefined) return { ...position, history, selected: null };
    const next = nextPosition(plans, position, answer);
    if (!next) return { ...position, history, selected: answer };
    history.push({ ...position, answer });
    position = next;
  }
}

/** Only the path the parent confirmed may contribute evidence after a correction. */
export function sessionAnswers(plans: MapQuestionPlan[], session: QuestionSession): Record<string, MapAnswerInput> {
  const visits = session.selected === null ? session.history : [...session.history, { ...session, answer: session.selected }];
  const answers: Record<string, MapAnswerInput> = {};
  for (const visit of visits) {
    const step = stepFor(plans, visit.subjectIndex, visit.cursor);
    if (step) answers[step.item.id] = { itemId: step.item.id, answer: visit.answer };
  }
  return answers;
}
