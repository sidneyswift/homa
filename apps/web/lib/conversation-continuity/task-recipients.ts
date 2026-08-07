import type { FamilyDeliveryRecipient } from "./delivery-ledger";

/**
 * selectTaskDeliveryRecipients(recipients, recipientMemberUserId)
 * Narrows a family's delivery roster to the ONE adult a scheduled task
 * belongs to (founder ruling 2026-07-12: only the main parent, the
 * account owner, is auto-subscribed to daily task texts; an invited
 * adult opts in by creating their own task).
 *
 * Rules, in order:
 *   - No member rows at all: keep the legacy full fan-out (family email
 *     plus loose phones is all that exists).
 *   - The named recipient, or the family's first member (the account
 *     owner) when the row carries none or the member left.
 *   - A single-adult family also keeps its unattributed phone rows:
 *     numbers linked before per-member attribution can only be theirs.
 */
export function selectTaskDeliveryRecipients(
  recipients: FamilyDeliveryRecipient[],
  recipientMemberUserId: string | null,
  requireExactRecipient = false,
): FamilyDeliveryRecipient[] {
  if (requireExactRecipient) {
    if (recipientMemberUserId === null) return [];
    return recipients.filter(
      (recipient) => recipient.memberUserId === recipientMemberUserId,
    );
  }
  const members = recipients.filter(
    (recipient) => recipient.memberUserId !== null,
  );
  if (members.length === 0) return recipients;

  const target =
    members.find(
      (recipient) => recipient.memberUserId === recipientMemberUserId,
    ) ?? members[0];

  const selected = [target];
  if (members.length === 1) {
    selected.push(
      ...recipients.filter((recipient) =>
        recipient.recipientKey.startsWith("phone:"),
      ),
    );
  }
  return selected;
}
