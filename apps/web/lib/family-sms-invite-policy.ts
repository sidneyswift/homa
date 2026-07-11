/** Durable limits for the one model-supplied SMS destination in Homa. */
export const MAX_FAMILY_SMS_INVITES_PER_FAMILY_PER_DAY = 5;
export const MAX_FAMILY_SMS_INVITES_PER_DESTINATION_PER_DAY = 2;
export const FAMILY_SMS_INVITE_TTL_DAYS = 7;

export type FamilySmsInviteSendBlockReason =
  | "same-number"
  | "already-linked"
  | "number-in-use"
  | "pending-elsewhere"
  | "send-limit";

/**
 * Pure policy for deciding whether a linked parent may send one family
 * invitation. Database queries gather the facts; this function keeps the
 * security decision explicit and testable.
 */
export function getFamilySmsInviteSendBlockReason(input: {
  familyId: string;
  sourcePhoneE164: string;
  destinationPhoneE164: string;
  destinationOwnerFamilyId: string | null;
  pendingFamilyId: string | null;
  recentFamilySendCount: number;
  recentDestinationSendCount: number;
}): FamilySmsInviteSendBlockReason | null {
  if (input.sourcePhoneE164 === input.destinationPhoneE164) {
    return "same-number";
  }
  if (input.destinationOwnerFamilyId === input.familyId) {
    return "already-linked";
  }
  if (input.destinationOwnerFamilyId) {
    return "number-in-use";
  }
  if (input.pendingFamilyId && input.pendingFamilyId !== input.familyId) {
    return "pending-elsewhere";
  }
  if (
    input.recentFamilySendCount >= MAX_FAMILY_SMS_INVITES_PER_FAMILY_PER_DAY ||
    input.recentDestinationSendCount >=
      MAX_FAMILY_SMS_INVITES_PER_DESTINATION_PER_DAY
  ) {
    return "send-limit";
  }
  return null;
}
