export type FamilySmsInviteConsentDecision = "accept" | "decline";
export type FamilySmsInviteParentDecision = "confirm" | "cancel";

const ACCEPTANCE_PATTERN = /^yes[.!]?$/iu;
const DECLINE_PATTERN = /^(?:no|no thanks|i decline|decline)[.!]?$/iu;
const PARENT_CONFIRMATION_PATTERN =
  /^(confirm|cancel)\s+(\d{6})[.]?$/iu;

/**
 * Consent is a channel fact, not a model judgment. Only a complete text
 * message with no attachments can authorize the response tool.
 */
export function classifyFamilySmsInviteConsent(input: {
  text: string;
  hasAttachments: boolean;
}): FamilySmsInviteConsentDecision | null {
  if (input.hasAttachments) return null;
  const text = input.text.trim().replace(/\s+/gu, " ");
  if (ACCEPTANCE_PATTERN.test(text)) return "accept";
  if (DECLINE_PATTERN.test(text)) return "decline";
  return null;
}

export function classifyFamilySmsInviteParentConfirmation(input: {
  text: string;
  hasAttachments: boolean;
}): {
  decision: FamilySmsInviteParentDecision;
  confirmationCode: string;
} | null {
  if (input.hasAttachments) return null;
  const text = input.text.trim().replace(/\s+/gu, " ");
  const match = PARENT_CONFIRMATION_PATTERN.exec(text);
  if (!match) return null;
  return {
    decision: match[1].toLowerCase() as FamilySmsInviteParentDecision,
    confirmationCode: match[2],
  };
}
