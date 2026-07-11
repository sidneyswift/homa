import { formatUsPhone } from "@homa/core";

/**
 * Server-owned copy for phone invitations. The pre-consent builder does
 * not accept child data, which makes the privacy boundary structural
 * instead of relying on the agent to remember it.
 */

const LEARNING_UPDATE_MAX_LENGTH = 240;

function normalizeSmsFragment(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, maxLength).trim();
}

function endAsSentence(value: string): string {
  return /[.!?]$/u.test(value) ? value : `${value}.`;
}

export function normalizeFamilySmsLearningUpdate(value: string): string {
  return normalizeSmsFragment(value, LEARNING_UPDATE_MAX_LENGTH);
}

export function buildFamilySmsInvitationText(): string {
  return (
    "Hi, it's Homa, a homeschool assistant. Someone entered this number to invite a family member. " +
    `This message contains no child or family information. Nothing is shared unless both phones confirm. ` +
    `After both confirmations, this number gets access to the family's Homa account. ` +
    `With access, you can text Homa about the kids, Homa conversations, or learning materials. ` +
    `If you expected this invitation, you can reply "yes" to ask the parent to confirm your number. ` +
    `You can reply "no" to decline. "Stop" ends texts from Homa.`
  );
}

export function buildFamilySmsRecipientAcceptedText(): string {
  return (
    "Your yes was received. I asked the parent who sent this invitation to confirm the phone number. " +
    "Your number does not have access to the family's Homa account yet. " +
    "No child information has been shared. " +
    "I will text you again after they confirm."
  );
}

export function buildFamilySmsRecipientConfirmationUnavailableText(): string {
  return (
    "I received your yes. I could not reach the parent to confirm this number. " +
    "Your number does not have access to the family's Homa account. " +
    "No child information was shared. " +
    "You can ask them to send a new invitation."
  );
}

export function buildFamilySmsRecipientConfirmationUnknownText(): string {
  return (
    "I received your yes. I do not know whether the parent received my request to confirm this number. " +
    "Your number does not have access to the family's Homa account yet. " +
    "No child information has been shared. " +
    "You can contact the parent directly while this invitation waits for their confirmation."
  );
}

export function buildFamilySmsInviterConfirmationText(input: {
  confirmationCode: string;
  recipientPhoneE164: string;
}): string {
  const phone = formatUsPhone(input.recipientPhoneE164);
  return (
    `The person using ${phone} replied yes to your Homa invitation. ` +
    `No child information has been shared. ` +
    `If this is the family member you intended, you can reply "confirm ${input.confirmationCode}". ` +
    `If not, you can reply "cancel ${input.confirmationCode}".`
  );
}

export function buildFamilySmsInviterCanceledText(): string {
  return (
    "Canceled. That number does not have access to your family's Homa account. " +
    "I did not share child information."
  );
}

export function buildFamilySmsInviterExpiredText(): string {
  return (
    "That confirmation has expired. The number does not have access to your family's Homa account. " +
    "No child information was shared. " +
    "You can send a new invitation."
  );
}

export function buildFamilySmsInviterConfirmedText(input: {
  recipientPhoneE164: string;
  updateDelivery: "submitted" | "unconfirmed";
}): string {
  const phone = formatUsPhone(input.recipientPhoneE164);
  const delivery =
    input.updateDelivery === "submitted"
      ? "I sent the saved learning update to that number."
      : "I could not confirm the learning update reached that number. You can send the learning update yourself. The person using that number can text Homa now.";
  return (
    `Confirmed. ${phone} now has access to your family's Homa account. ` +
    delivery
  );
}

export function buildFamilySmsAcceptanceText(input: {
  inviterName: string | null;
  childName: string | null;
  learningUpdate: string;
}): string {
  const inviter = input.inviterName
    ? normalizeSmsFragment(input.inviterName, 80)
    : "A parent in the family";
  const childName = input.childName
    ? normalizeSmsFragment(input.childName, 80)
    : "";
  const update = normalizeFamilySmsLearningUpdate(input.learningUpdate);
  const confirmation = input.inviterName
    ? ` ${normalizeSmsFragment(input.inviterName, 80)} confirmed this access.`
    : "";
  const learningSentence =
    childName && update
      ? ` ${childName} ${endAsSentence(update)}`
      : "";

  return (
    `You now have access to the family's Homa account through this number.` +
    `${confirmation}${learningSentence} You can text Homa about the kids, Homa conversations, or learning materials anytime. ` +
    `${inviter} can remove this number in Homa settings. "Stop" ends texts from Homa. ` +
    `It does not remove access to the family's Homa account.`
  );
}

export function buildFamilySmsDeclineText(): string {
  return (
    "No problem. This number does not have access to the family's Homa account. " +
    "I did not share child information."
  );
}

export function buildFamilySmsExpiredText(): string {
  return (
    "That invitation has expired. Your number does not have access to the family's Homa account. " +
    "No child information was shared. " +
    "You can ask the person who invited you to send a new invitation."
  );
}

export function buildFamilySmsNumberInUseText(): string {
  return (
    "This number is already connected to another Homa account. " +
    "I did not change either account."
  );
}

export function buildFamilySmsNoActiveInviteText(): string {
  return (
    "There is no active family invitation for this number. " +
    "You can ask the family to send a new one."
  );
}
