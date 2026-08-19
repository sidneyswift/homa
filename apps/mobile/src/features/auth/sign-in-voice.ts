import type { SignInFlowResult } from "./sign-in-result";

/**
 * Turns a non-success Google or Apple result into what the parent reads,
 * or null to stay quiet.
 *
 * Founder ruling 2026-08-18: Homa says nothing when the provider already
 * spoke. A parent who closed the sheet knows why they are back, and a
 * parent Apple or Google turned away has just read that provider's own
 * dialog naming the cause and offering a way forward. A second, vaguer
 * line from Homa on top of that only contradicts a better answer.
 *
 * The one case that speaks is the provider clearing the parent and our
 * own exchange failing anyway. They did everything asked, no one has
 * explained anything, and they are looking at a screen that did nothing.
 *
 * Lives apart from the screen so the rule is testable without React
 * Native, and so there is one home for the copy instead of a literal
 * sitting inline where nothing guards it.
 */
export function signInFailureMessage(result: SignInFlowResult): string | null {
  if (result.status === "dismissed") return null;
  if (result.status === "provider-declined") return null;
  return "Homa couldn't finish signing you in. Nothing to fix on your end. Worth trying again in a moment.";
}
