export const ABILITY_QUESTION_DRAFT = "ability-question";

export function abilityQuestion(childName: string, abilityName: string): string {
  return `Help me understand ${childName}'s saved progress for this ability: ${abilityName}. What does the evidence show, and what is still unknown?`;
}

export function abilityQuestionHref(childId: string, abilityId: string): `/app?${string}` {
  return `/app?${new URLSearchParams({ draft: ABILITY_QUESTION_DRAFT, child: childId, ability: abilityId })}`;
}
