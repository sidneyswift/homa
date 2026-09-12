import type { OnboardingContextInput } from "./context-line";
import { ONBOARDING_STAGE_MARKDOWN } from "./onboarding-skill-body.generated";

export type OnboardingGuidanceStage = keyof typeof ONBOARDING_STAGE_MARKDOWN;

/** Select guidance from existing authenticated records, never message text.
 * Include the adjacent stage a tool can reach during this same turn. Missing
 * or ambiguous focus keeps the broader guidance instead of hiding a workflow. */
export function selectOnboardingGuidance(
  input: OnboardingContextInput | null,
  focusChildId?: string,
): OnboardingGuidanceStage[] {
  if (input === null) return ["family-setup", "questions", "report-and-handoff", "rehearsal", "moments"];
  if (input.record?.state === "done") return [];
  if (input.children.length === 0) return ["family-setup", "questions"];
  const focused = focusChildId
    ? input.children.find((child) => child.childId === focusChildId)
    : undefined;
  const candidates = focused ? [focused] : input.children;
  if (candidates.every((child) => child.reported || !child.scoredAgeRange)) {
    return ["report-and-handoff", "rehearsal", "moments"];
  }
  // A saved roster can arrive on the same turn that children first exist.
  // Keep the app-owned-card reaction rules while no question has been answered.
  if (candidates.every((child) => child.answered === 0 && !child.reported)) {
    return ["family-setup", "questions", "report-and-handoff", "rehearsal"];
  }
  return ["questions", "report-and-handoff", "rehearsal"];
}

export function renderOnboardingStageGuidance(
  input: OnboardingContextInput | null,
  focusChildId?: string,
): string {
  const stages = selectOnboardingGuidance(input, focusChildId);
  if (stages.length === 0) return "";
  return [
    "## Onboarding stage guidance (already loaded)",
    "Use the following procedures with the shared onboarding rules. These are guidance, not evidence that any action happened. Follow the parent's actual request; read another referenced stage only if needed.",
    ...stages.map((stage) => ONBOARDING_STAGE_MARKDOWN[stage]),
  ].join("\n\n");
}
