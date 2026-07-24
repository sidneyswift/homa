/**
 * The one-question the in-turn generation tools ask before existing on
 * a turn (chat-first onboarding plan §2.6: generation delivery during
 * onboarding is async, never in-turn masking).
 *
 * Eve is one-turn-at-a-time: while create_printable or generate_image
 * runs, nothing streams and the parent watches a still screen. For a
 * finished family that is a priced tradeoff she opted into by asking.
 * For a family still in her first days it is the exact experience the
 * artifact moment exists to remove, and prose alone did not remove it:
 * with the first-making tool available AND the skill text instructing
 * it, the model still reached for the in-turn build twice in live
 * walks (2026-07-23). So the rule is structural, the same move as the
 * ENDS_THE_TURN set: during web onboarding the in-turn tools do not
 * exist, and the background making is the only path a page can take.
 *
 * Suppression is deliberately narrow: only a card-capable web session
 * of a family whose onboarding is still active. The agent-job build
 * session (channel "agent-job") is where the first making actually
 * renders, so it must keep create_printable; SMS, email, dispatch, and
 * subject-lesson sessions are untouched.
 */

/** Channels where chat cards cannot render; suppression never applies. */
const NON_WEB_CHANNELS = new Set([
  "sms",
  "email",
  "dispatch",
  "agent-job",
  "subject_lesson",
]);

export interface GenerationGateAttributes {
  channel?: string;
  onboardingActive?: string;
}

export function suppressInTurnGeneration(
  attributes: GenerationGateAttributes | undefined,
): boolean {
  if (attributes?.onboardingActive !== "true") return false;
  const channel = attributes.channel;
  if (channel !== undefined && NON_WEB_CHANNELS.has(channel)) return false;
  return true;
}
