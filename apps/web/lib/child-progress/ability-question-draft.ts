import { findAbilitiesExplorerAbility } from "./abilities-explorer";
import { ABILITY_QUESTION_DRAFT, abilityQuestion } from "./ability-question";

/** URL coordinates select a request, never supply its words or family scope.
 * The visible question carries its own scope even after the focus cookie expires.
 * Sending it is the parent's separate action, not an assessment or progress write.
 */
export function abilityQuestionDraft(input: {
  draft: unknown;
  childId: unknown;
  abilityId: unknown;
  children: readonly { id: string; name: string }[];
}): string | undefined {
  if (input.draft !== ABILITY_QUESTION_DRAFT || typeof input.childId !== "string" ||
    typeof input.abilityId !== "string" || input.abilityId.length > 240) return undefined;
  const child = input.children.find((row) => row.id === input.childId);
  if (!child) return undefined;
  const ability = findAbilitiesExplorerAbility(input.abilityId);
  return ability ? abilityQuestion(child.name, ability.name) : undefined;
}
