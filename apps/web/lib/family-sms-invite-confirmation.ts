import {
  buildFamilySmsAcceptanceText,
  buildFamilySmsInviterCanceledText,
  buildFamilySmsInviterConfirmedText,
  buildFamilySmsInviterExpiredText,
  buildFamilySmsNoActiveInviteText,
  buildFamilySmsNumberInUseText,
} from "./family-sms-invite-copy";
import type { FamilySmsInviteParentDecision } from "./family-sms-invite-consent";
import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";
import { hashToken } from "./map/tokens";
import { markLeadConverted } from "./phone-leads";
import { submitHomaSms } from "./voice/telnyx-api";

export interface FamilySmsInviterConfirmationContext {
  confirmationCodeHash: string;
  decision: FamilySmsInviteParentDecision;
  inviteId: string;
}

export async function findFamilySmsInviterConfirmationContext(input: {
  familyId: string;
  inviterPhoneE164: string;
  confirmationCode: string;
  decision: FamilySmsInviteParentDecision;
}): Promise<FamilySmsInviterConfirmationContext | null> {
  const sql = mapDb();
  const confirmationCodeHash = hashToken(input.confirmationCode);
  const rows = await sql<{ id: string; confirmation_code_hash: string }[]>`
    select id, confirmation_code_hash
    from public.family_sms_invites
    where family_id = ${input.familyId}
      and inviter_phone_e164 = ${input.inviterPhoneE164}
      and confirmation_code_hash = ${confirmationCodeHash}
      and status in ('recipient_accepted', 'expired')
    order by created_at desc
    limit 1
  `;
  return rows[0]
    ? {
        confirmationCodeHash: rows[0].confirmation_code_hash,
        decision: input.decision,
        inviteId: rows[0].id,
      }
    : null;
}

export type ConfirmFamilySmsInviteResult = {
  confirmed: boolean;
  canceled: boolean;
  replyText: string;
};

interface ConfirmationRow {
  id: string;
  family_id: string;
  invited_by: string | null;
  inviter_name: string | null;
  inviter_phone_e164: string;
  phone_e164: string;
  learning_update: string;
  status: string;
  expired: boolean;
  child_name: string | null;
  accepted_message_id: string | null;
}

type ConfirmationTransactionResult =
  | {
      kind: "confirmed";
      familyId: string;
      inviterName: string | null;
      recipientPhoneE164: string;
      childName: string | null;
      learningUpdate: string;
      linkedNow: boolean;
      newlyConfirmed: boolean;
      acceptedMessageId: string | null;
    }
  | { kind: "canceled" }
  | { kind: "expired" }
  | { kind: "number-in-use" }
  | { kind: "not-found" };

export async function confirmFamilySmsInvite(input: {
  familyId: string;
  confirmationCodeHash: string;
  inviterPhoneE164: string;
  inviteId: string;
  decision: FamilySmsInviteParentDecision;
}): Promise<ConfirmFamilySmsInviteResult> {
  const sql = mapDb();
  const preview = await sql<{ phone_e164: string }[]>`
    select phone_e164
    from public.family_sms_invites
    where id = ${input.inviteId}
      and family_id = ${input.familyId}
      and inviter_phone_e164 = ${input.inviterPhoneE164}
      and confirmation_code_hash = ${input.confirmationCodeHash}
  `;
  const recipientPhoneE164 = preview[0]?.phone_e164;
  if (!recipientPhoneE164) {
    return {
      confirmed: false,
      canceled: false,
      replyText: buildFamilySmsNoActiveInviteText(),
    };
  }

  const result = await sql.begin<ConfirmationTransactionResult>(async (tx) => {
    await tx`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${"family-sms-invite:phone:" + recipientPhoneE164},
          0
        )
      )
    `;
    const rows = await tx<ConfirmationRow[]>`
      select i.id, i.family_id, i.invited_by::text as invited_by,
             i.inviter_name, i.inviter_phone_e164, i.phone_e164,
             i.learning_update, i.status, i.expires_at <= now() as expired,
             i.accepted_message_id, c.name as child_name
      from public.family_sms_invites i
      left join public.children c
        on c.id = i.child_id and c.family_id = i.family_id
      where i.id = ${input.inviteId}
        and i.family_id = ${input.familyId}
        and i.inviter_phone_e164 = ${input.inviterPhoneE164}
        and i.confirmation_code_hash = ${input.confirmationCodeHash}
      for update of i
    `;
    const invite = rows[0];
    if (!invite) return { kind: "not-found" };
    if (invite.status === "declined") return { kind: "canceled" };
    if (invite.status === "expired" || invite.expired) {
      if (invite.status === "recipient_accepted") {
        await tx`
          update public.family_sms_invites
          set status = 'expired'
          where id = ${invite.id} and status = 'recipient_accepted'
        `;
      }
      return { kind: "expired" };
    }
    if (invite.status === "accepted") {
      const owner = await tx<{ family_id: string }[]>`
        select family_id
        from public.family_phones
        where phone_e164 = ${invite.phone_e164}
      `;
      if (owner[0]?.family_id !== invite.family_id) {
        return { kind: "not-found" };
      }
      return {
        kind: "confirmed",
        familyId: invite.family_id,
        inviterName: invite.inviter_name,
        recipientPhoneE164: invite.phone_e164,
        childName: invite.child_name,
        learningUpdate: invite.learning_update,
        linkedNow: false,
        newlyConfirmed: false,
        acceptedMessageId: invite.accepted_message_id,
      };
    }
    if (invite.status !== "recipient_accepted") {
      return { kind: "not-found" };
    }

    if (input.decision === "cancel") {
      await tx`
        update public.family_sms_invites
        set status = 'declined'
        where id = ${invite.id} and status = 'recipient_accepted'
      `;
      return { kind: "canceled" };
    }

    const ownerRows = await tx<{ family_id: string }[]>`
      select family_id
      from public.family_phones
      where phone_e164 = ${invite.phone_e164}
      for update
    `;
    const ownerFamilyId = ownerRows[0]?.family_id;
    if (ownerFamilyId && ownerFamilyId !== invite.family_id) {
      await tx`
        update public.family_sms_invites
        set status = 'failed'
        where id = ${invite.id} and status = 'recipient_accepted'
      `;
      return { kind: "number-in-use" };
    }

    let linkedNow = false;
    if (!ownerFamilyId) {
      const inserted = await tx<{ family_id: string }[]>`
        insert into public.family_phones (
          family_id, phone_e164, added_by, member_user_id, source
        )
        values (
          ${invite.family_id}, ${invite.phone_e164},
          ${invite.invited_by}, null, 'bridge'
        )
        on conflict do nothing
        returning family_id
      `;
      if (inserted[0]) {
        linkedNow = true;
      } else {
        const current = await tx<{ family_id: string }[]>`
          select family_id
          from public.family_phones
          where phone_e164 = ${invite.phone_e164}
        `;
        if (current[0]?.family_id !== invite.family_id) {
          await tx`
            update public.family_sms_invites
            set status = 'failed'
            where id = ${invite.id} and status = 'recipient_accepted'
          `;
          return { kind: "number-in-use" };
        }
      }
    }

    await tx`
      update public.family_sms_invites
      set status = 'accepted', inviter_confirmed_at = now()
      where id = ${invite.id} and status = 'recipient_accepted'
    `;
    return {
      kind: "confirmed",
      familyId: invite.family_id,
      inviterName: invite.inviter_name,
      recipientPhoneE164: invite.phone_e164,
      childName: invite.child_name,
      learningUpdate: invite.learning_update,
      linkedNow,
      newlyConfirmed: true,
      acceptedMessageId: null,
    };
  });

  switch (result.kind) {
    case "confirmed": {
      if (!result.newlyConfirmed) {
        return {
          confirmed: true,
          canceled: false,
          replyText: buildFamilySmsInviterConfirmedText({
            recipientPhoneE164: result.recipientPhoneE164,
            updateDelivery: result.acceptedMessageId
              ? "submitted"
              : "unconfirmed",
          }),
        };
      }
      if (result.linkedNow) {
        await emitMapEvent("sms.family_linked", {
          family_id: result.familyId,
          source: "bridge",
          replaced: false,
        });
        await markLeadConverted(result.recipientPhoneE164).catch(() => {});
      }
      await emitMapEvent("family.invite_accepted", {
        family_id: result.familyId,
        channel: "sms",
      });

      const submission = await submitHomaSms(
        result.recipientPhoneE164,
        buildFamilySmsAcceptanceText({
          inviterName: result.inviterName,
          childName: result.childName,
          learningUpdate: result.learningUpdate,
        }),
      );
      if (submission.status === "submitted") {
        await sql`
          update public.family_sms_invites
          set accepted_message_id = ${submission.messageId}
          where id = ${input.inviteId} and status = 'accepted'
        `;
      }
      return {
        confirmed: true,
        canceled: false,
        replyText: buildFamilySmsInviterConfirmedText({
          recipientPhoneE164: result.recipientPhoneE164,
          updateDelivery:
            submission.status === "submitted" ? "submitted" : "unconfirmed",
        }),
      };
    }
    case "canceled":
      return {
        confirmed: false,
        canceled: true,
        replyText: buildFamilySmsInviterCanceledText(),
      };
    case "expired":
      return {
        confirmed: false,
        canceled: false,
        replyText: buildFamilySmsInviterExpiredText(),
      };
    case "number-in-use":
      return {
        confirmed: false,
        canceled: false,
        replyText: buildFamilySmsNumberInUseText(),
      };
    case "not-found":
      return {
        confirmed: false,
        canceled: false,
        replyText: buildFamilySmsNoActiveInviteText(),
      };
    default: {
      const exhaustive: never = result;
      throw new Error(`unhandled inviter confirmation: ${String(exhaustive)}`);
    }
  }
}
