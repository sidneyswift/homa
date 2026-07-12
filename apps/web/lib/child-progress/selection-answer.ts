export const CHILD_ANSWER_SELECTION_PREFIX = "child-answer:";

export function childAnswerSelectionId(
  childId: string,
  itemId: string,
): string {
  return `${CHILD_ANSWER_SELECTION_PREFIX}${childId}:${itemId}`;
}
