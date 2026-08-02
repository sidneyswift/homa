export type ConversationMessageSource = "parent" | "saved_card_answer";

export const HOMA_MESSAGE_SOURCE_HEADER = "x-homa-message-source";

const SAVED_CARD_ANSWER_HEADER_VALUE = "saved-card-answer";

interface MessageSourceAttributes {
  messageSource?: unknown;
  onboardingActive?: unknown;
}

export function messageSourceFromRequest(
  request: Request,
): ConversationMessageSource {
  return request.headers.get(HOMA_MESSAGE_SOURCE_HEADER) ===
    SAVED_CARD_ANSWER_HEADER_VALUE
    ? "saved_card_answer"
    : "parent";
}

export function messageSourceHeaders(
  source: ConversationMessageSource,
): Readonly<Record<string, string>> {
  return {
    [HOMA_MESSAGE_SOURCE_HEADER]:
      source === "saved_card_answer"
        ? SAVED_CARD_ANSWER_HEADER_VALUE
        : "parent",
  };
}

/**
 * A saved card response is exact request provenance, not an inference from
 * the parent's words. The onboarding check scopes the behavior to the only
 * flow where the client owns the next card and the corresponding writes.
 */
export function isSavedOnboardingCardAnswer(
  attributes: MessageSourceAttributes | undefined,
): boolean {
  return (
    attributes?.onboardingActive === "true" &&
    attributes.messageSource === "saved_card_answer"
  );
}

/** Current-turn pointer only. The onboarding skill owns the full procedure. */
export function messageSourceContext(
  attributes: MessageSourceAttributes | undefined,
): string[] {
  if (!isSavedOnboardingCardAnswer(attributes)) return [];
  return [
    [
      "## Saved onboarding card response",
      "",
      "The current message came from an authenticated product card after its save completed. Apply the onboarding skill's saved-card-response branch. Treat the words as the parent's answer, not as facts that still need writing.",
    ].join("\n"),
  ];
}
