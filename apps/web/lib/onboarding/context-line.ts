import type { ChecklistState } from "./checklist-state";
import type { OnboardingRecord } from "./state";

/**
 * The one line of onboarding state Homa reads every turn
 * (plans/2026-07-21-chat-first-onboarding.md §2.2).
 *
 * It exists so Homa can open a return visit with where things stand
 * rather than a greeting, and so she never asks a question the family
 * record already answers. Asking a parent something she told you on
 * Tuesday is the fastest way to look like a form.
 *
 * Two kinds of fact, kept apart on purpose:
 * - Derived, recomputed here every turn: how many children exist, how
 *   far each one got, whether a report was built. A stored copy would go
 *   stale the moment she answered on another device, and Homa would then
 *   say something the screen contradicts.
 * - Recorded, read from the durable record: which beats have already
 *   fired, and whether the paywall has been shown. Those leave no trace
 *   anywhere else, so they are the only things written down.
 */

export interface OnboardingContextInput {
  record: OnboardingRecord | null;
  children: ChecklistState[];
}

function childPhrase(child: ChecklistState): string {
  if (!child.scoredAgeRange) return `${child.childName} outside the question ages`;
  if (child.reported) return `${child.childName} report ready`;
  if (child.complete) return `${child.childName} answered, not scored yet`;
  if (child.answered === 0) return `${child.childName} not started`;
  return `${child.childName} ${child.answered} answered, ${child.remaining} left`;
}

/**
 * renderOnboardingContext(input): one plain line, or null when there is
 * nothing worth saying. Null matters: an empty section header would tell
 * Homa there is a state machine to talk about, and there is not.
 */
export function renderOnboardingContext(
  input: OnboardingContextInput,
): string | null {
  const parts: string[] = [];

  if (input.children.length === 0) {
    parts.push("no children added yet");
  } else {
    parts.push(input.children.map(childPhrase).join(" · "));
  }

  const beats = input.record?.beatsDone ?? [];
  if (beats.length > 0) parts.push(`already done: ${beats.join(", ")}`);
  if (input.record?.paywallShownAt) parts.push("membership already offered");

  if (parts.length === 0) return null;
  return [
    "## Where this family is in their first days",
    "",
    "Facts, not instructions. Never read them back to her, and never ask her something this line already answers.",
    "",
    parts.join(" · "),
  ].join("\n");
}
