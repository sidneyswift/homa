import { randomInt } from "node:crypto";

import {
  buildFamilySmsDeclineText,
  buildFamilySmsExpiredText,
  buildFamilySmsInviterConfirmationText,
  buildFamilySmsNoActiveInviteText,
  buildFamilySmsNumberInUseText,
  buildFamilySmsRecipientAcceptedText,
  buildFamilySmsRecipientConfirmationUnavailableText,
  buildFamilySmsRecipientConfirmationUnknownText,
} from "./family-sms-invite-copy";
import { mapDb } from "./map/db";
import { hashToken } from "./map/tokens";
import { submitHomaSms } from "./voice/telnyx-api";

type FamilySmsInviteStatus =
  | "sending"
  | "pending"
  | "recipient_accepted"
  | "accepted"
  | "declined"
  | "superseded"
  | "expired"
  | "failed";

export type RespondToFamilySmsInviteResult = {
  recipientAccepted: boolean;
  declined: boolean;
  replyText: string;
};

interface FamilySmsInviteResponseRow {
  id: string;
  family_id: string;
  inviter_phone_e164: string;
  status: FamilySmsInviteStatus;
  expired: boolean;
}

type ResponseTransactionResult =
  | {
      kind: "notify-parent";
      inviteId: string;
      inviterPhoneE164: string;
      confirmationCode: string;
      confirmationCodeHash: string;
    }
  | { kind: "awaiting-parent" }
  | { kind: "declined" }
  | { kind: "expired" }
  | { kind: "number-in-use" }
  | { kind: "not-found" };

function newConfirmationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Records the invited phone's decision. A yes moves only to
 * recipient_accepted and asks the original linked parent for a coded
 * confirmation. It never links the phone or returns child information.
 */
export async function respondToFamilySmsInvite(
  phoneE164: string,
  inviteId: string,
  response: "accept" | "decline",
): Promise<RespondToFamilySmsInviteResult> {
  const sql = mapDb();
  let result: ResponseTransactionResult | null = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const confirmationCode = newConfirmationCode();
    const confirmationCodeHash = hashToken(confirmationCode);

    try {
      result = await sql.begin<ResponseTransactionResult>(async (tx) => {
        await tx`
      select pg_advisory_xact_lock(
        hashtextextended(${"family-sms-invite:phone:" + phoneE164}, 0)
      )
    `;
    const rows = await tx<FamilySmsInviteResponseRow[]>`
      select id, family_id, inviter_phone_e164, status,
             expires_at <= now() as expired
      from public.family_sms_invites
      where id = ${inviteId} and phone_e164 = ${phoneE164}
      for update
    `;
    const invite = rows[0];
    if (!invite) return { kind: "not-found" };

    if (invite.status === "declined") return { kind: "declined" };
    if (
      invite.status === "expired" ||
      (invite.expired &&
        (invite.status === "pending" ||
          invite.status === "recipient_accepted"))
    ) {
      if (invite.status === "pending" || invite.status === "recipient_accepted") {
        await tx`
          update public.family_sms_invites
          set status = 'expired',
              responded_at = coalesce(responded_at, now())
          where id = ${invite.id}
            and status in ('pending', 'recipient_accepted')
        `;
      }
      return { kind: "expired" };
    }

    if (invite.status === "recipient_accepted") {
      if (response === "decline") {
        await tx`
          update public.family_sms_invites
          set status = 'declined'
          where id = ${invite.id} and status = 'recipient_accepted'
        `;
        return { kind: "declined" };
      }
      return { kind: "awaiting-parent" };
    }
    if (invite.status !== "pending") return { kind: "not-found" };

    if (response === "decline") {
      await tx`
        update public.family_sms_invites
        set status = 'declined', responded_at = now()
        where id = ${invite.id} and status = 'pending'
      `;
      return { kind: "declined" };
    }

    const ownerRows = await tx<{ family_id: string }[]>`
      select family_id from public.family_phones
      where phone_e164 = ${phoneE164}
      for update
    `;
    if (ownerRows[0] && ownerRows[0].family_id !== invite.family_id) {
      await tx`
        update public.family_sms_invites
        set status = 'failed', responded_at = now()
        where id = ${invite.id} and status = 'pending'
      `;
      return { kind: "number-in-use" };
    }

    await tx`
      update public.family_sms_invites
      set status = 'recipient_accepted',
          responded_at = now(),
          recipient_accepted_at = now(),
          confirmation_code_hash = ${confirmationCodeHash}
      where id = ${invite.id} and status = 'pending'
    `;
    return {
      kind: "notify-parent",
      inviteId: invite.id,
      inviterPhoneE164: invite.inviter_phone_e164,
      confirmationCode,
      confirmationCodeHash,
    };
      });
      break;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") continue;
      throw error;
    }
  }
  if (!result) {
    return {
      recipientAccepted: false,
      declined: false,
      replyText: buildFamilySmsRecipientConfirmationUnavailableText(),
    };
  }

  switch (result.kind) {
    case "notify-parent": {
      const submission = await submitHomaSms(
        result.inviterPhoneE164,
        buildFamilySmsInviterConfirmationText({
          confirmationCode: result.confirmationCode,
          recipientPhoneE164: phoneE164,
        }),
      );
      if (submission.status === "rejected") {
        await sql`
          update public.family_sms_invites
          set status = 'failed'
          where id = ${result.inviteId}
            and status = 'recipient_accepted'
            and confirmation_code_hash = ${result.confirmationCodeHash}
        `;
        return {
          recipientAccepted: false,
          declined: false,
          replyText: buildFamilySmsRecipientConfirmationUnavailableText(),
        };
      }
      if (submission.status === "unknown") {
        return {
          recipientAccepted: true,
          declined: false,
          replyText: buildFamilySmsRecipientConfirmationUnknownText(),
        };
      }
      await sql`
        update public.family_sms_invites
        set confirmation_message_id = ${submission.messageId}
        where id = ${result.inviteId}
          and status = 'recipient_accepted'
          and confirmation_code_hash = ${result.confirmationCodeHash}
      `;
      return {
        recipientAccepted: true,
        declined: false,
        replyText: buildFamilySmsRecipientAcceptedText(),
      };
    }
    case "awaiting-parent":
      return {
        recipientAccepted: true,
        declined: false,
        replyText: buildFamilySmsRecipientAcceptedText(),
      };
    case "declined":
      return {
        recipientAccepted: false,
        declined: true,
        replyText: buildFamilySmsDeclineText(),
      };
    case "expired":
      return {
        recipientAccepted: false,
        declined: false,
        replyText: buildFamilySmsExpiredText(),
      };
    case "number-in-use":
      return {
        recipientAccepted: false,
        declined: false,
        replyText: buildFamilySmsNumberInUseText(),
      };
    case "not-found":
      return {
        recipientAccepted: false,
        declined: false,
        replyText: buildFamilySmsNoActiveInviteText(),
      };
    default: {
      const exhaustive: never = result;
      throw new Error(`unhandled family SMS invite response: ${String(exhaustive)}`);
    }
  }
}
