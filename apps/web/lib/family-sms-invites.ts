import {
  buildFamilySmsInvitationText,
  normalizeFamilySmsLearningUpdate,
} from "./family-sms-invite-copy";
import {
  FAMILY_SMS_INVITE_TTL_DAYS,
  getFamilySmsInviteSendBlockReason,
  type FamilySmsInviteSendBlockReason,
} from "./family-sms-invite-policy";
import { mapDb } from "./map/db";
import { emitMapEvent } from "./map/events";
import { submitHomaSms } from "./voice/telnyx-api";

/**
 * Consent-first invitations for adding another adult's phone to a family.
 * The initiating family is re-verified from its already-linked source
 * number. The destination is the one deliberate model-supplied SMS
 * address, but the server owns the pre-consent text and never includes
 * child information in it.
 */

export type FamilySmsInviteChannelState =
  | "pending"
  | "awaiting-parent"
  | "expired";

export interface FamilySmsInviteChannelContext {
  inviteId: string;
  state: FamilySmsInviteChannelState;
  sessionEpoch: string;
}

export type CreateFamilySmsInviteResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | FamilySmsInviteSendBlockReason
        | "source-not-linked"
        | "source-not-member"
        | "child-not-found"
        | "invalid-update"
        | "sms-failed"
        | "sms-uncertain";
    };

interface PreparedFamilySmsInvite {
  id: string;
}

function normalizeInviterName(value: string | null): string | null {
  const normalized = value?.trim().replace(/\s+/gu, " ").slice(0, 120).trim();
  return normalized || null;
}

/**
 * Used by the Telnyx channel before it decides whether an unknown number
 * is a marketing lead. No family id or invite content leaves this lookup.
 */
export async function findFamilySmsInviteChannelContext(
  phoneE164: string,
): Promise<FamilySmsInviteChannelContext | null> {
  const sql = mapDb();
  const rows = await sql<
    { id: string; status: "pending" | "recipient_accepted"; expired: boolean }[]
  >`
    select id, status, expires_at <= now() as expired
    from public.family_sms_invites
    where phone_e164 = ${phoneE164}
      and status in ('pending', 'recipient_accepted')
    order by created_at desc
    limit 1
  `;
  const invite = rows[0];
  if (!invite) return null;
  if (invite.expired) {
    await sql`
      update public.family_sms_invites
      set status = 'expired', responded_at = now()
      where id = ${invite.id}
        and status in ('pending', 'recipient_accepted')
    `;
  }
  return {
    inviteId: invite.id,
    state: invite.expired
      ? "expired"
      : invite.status === "recipient_accepted"
        ? "awaiting-parent"
        : "pending",
    sessionEpoch: `invite:${invite.id}`,
  };
}

export async function createFamilySmsInvite(input: {
  familyId: string;
  sourcePhoneE164: string;
  destinationPhoneE164: string;
  childId: string;
  learningUpdate: string;
  requestKey: string;
}): Promise<CreateFamilySmsInviteResult> {
  const learningUpdate = normalizeFamilySmsLearningUpdate(input.learningUpdate);
  if (!learningUpdate) return { ok: false, reason: "invalid-update" };

  const sql = mapDb();
  let prepared:
    | { ok: true; kind: "send"; invite: PreparedFamilySmsInvite }
    | { ok: true; kind: "replayed" }
    | { ok: false; reason: Exclude<CreateFamilySmsInviteResult, { ok: true }>["reason"] };

  try {
    prepared = await sql.begin(async (tx) => {
      await tx`
        select pg_advisory_xact_lock(
          hashtextextended(${"family-sms-invite:family:" + input.familyId}, 0)
        )
      `;
      await tx`
        select pg_advisory_xact_lock(
          hashtextextended(
            ${"family-sms-invite:phone:" + input.destinationPhoneE164},
            0
          )
        )
      `;
      const sourceRows = await tx<
        {
          member_user_id: string | null;
          inviter_name: string | null;
          is_member: boolean;
        }[]
      >`
        select p.member_user_id::text as member_user_id,
               m.display_name as inviter_name,
               m.user_id is not null as is_member
        from public.family_phones p
        left join public.family_members m
          on m.family_id = p.family_id and m.user_id = p.member_user_id
        where p.family_id = ${input.familyId}
          and p.phone_e164 = ${input.sourcePhoneE164}
      `;
      const source = sourceRows[0];
      if (!source) return { ok: false as const, reason: "source-not-linked" as const };
      if (!source.is_member) {
        return { ok: false as const, reason: "source-not-member" as const };
      }

      const childRows = await tx<{ id: string }[]>`
        select id from public.children
        where id = ${input.childId} and family_id = ${input.familyId}
      `;
      if (!childRows[0]) return { ok: false as const, reason: "child-not-found" as const };

      const replayRows = await tx<{ status: string }[]>`
        select status from public.family_sms_invites
        where request_key = ${input.requestKey}
        for update
      `;
      const replayStatus = replayRows[0]?.status;
      if (replayStatus === "sending") {
        return { ok: false as const, reason: "sms-uncertain" as const };
      }
      if (replayStatus === "failed") {
        return { ok: false as const, reason: "sms-failed" as const };
      }
      if (replayStatus) return { ok: true as const, kind: "replayed" as const };

      await tx`
        update public.family_sms_invites
        set status = 'expired', responded_at = now()
        where phone_e164 = ${input.destinationPhoneE164}
          and status in ('pending', 'recipient_accepted')
          and expires_at <= now()
      `;
      await tx`
        update public.family_sms_invites
        set status = 'failed', responded_at = now()
        where phone_e164 = ${input.destinationPhoneE164}
          and status = 'sending'
          and created_at <= now() - interval '10 minutes'
      `;

      const ownerRows = await tx<{ family_id: string }[]>`
        select family_id from public.family_phones
        where phone_e164 = ${input.destinationPhoneE164}
      `;
      const activeRows = await tx<
        {
          family_id: string;
          status: "sending" | "pending" | "recipient_accepted";
        }[]
      >`
        select family_id, status from public.family_sms_invites
        where phone_e164 = ${input.destinationPhoneE164}
          and status in ('sending', 'pending', 'recipient_accepted')
        limit 1
        for update
      `;
      if (
        activeRows[0]?.status === "sending" ||
        activeRows[0]?.status === "recipient_accepted"
      ) {
        return { ok: false as const, reason: "pending-elsewhere" as const };
      }
      const familyCountRows = await tx<{ count: string }[]>`
        select count(*)::text as count
        from public.family_sms_invites
        where family_id = ${input.familyId}
          and created_at > now() - interval '24 hours'
      `;
      const destinationCountRows = await tx<{ count: string }[]>`
        select count(*)::text as count
        from public.family_sms_invites
        where phone_e164 = ${input.destinationPhoneE164}
          and created_at > now() - interval '24 hours'
      `;

      const reason = getFamilySmsInviteSendBlockReason({
        familyId: input.familyId,
        sourcePhoneE164: input.sourcePhoneE164,
        destinationPhoneE164: input.destinationPhoneE164,
        destinationOwnerFamilyId: ownerRows[0]?.family_id ?? null,
        pendingFamilyId: activeRows[0]?.family_id ?? null,
        recentFamilySendCount: Number(familyCountRows[0]?.count ?? 0),
        recentDestinationSendCount: Number(destinationCountRows[0]?.count ?? 0),
      });
      if (reason) return { ok: false as const, reason };

      if (activeRows[0]?.family_id === input.familyId) {
        await tx`
          update public.family_sms_invites
          set status = 'superseded', responded_at = now()
          where phone_e164 = ${input.destinationPhoneE164} and status = 'pending'
        `;
      }

      const inviterName = normalizeInviterName(source.inviter_name);
      const inserted = await tx<{ id: string }[]>`
        insert into public.family_sms_invites (
          family_id, invited_by, inviter_name, inviter_phone_e164,
          phone_e164, child_id, learning_update, request_key, status,
          expires_at
        )
        values (
          ${input.familyId}, ${source.member_user_id}, ${inviterName},
          ${input.sourcePhoneE164}, ${input.destinationPhoneE164},
          ${input.childId}, ${learningUpdate}, ${input.requestKey}, 'sending',
          now() + (${FAMILY_SMS_INVITE_TTL_DAYS} * interval '1 day')
        )
        returning id
      `;
      return {
        ok: true as const,
        kind: "send" as const,
        invite: { id: inserted[0].id },
      };
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, reason: "pending-elsewhere" };
    }
    throw error;
  }

  if (!prepared.ok) return prepared;
  if (prepared.kind === "replayed") return { ok: true };

  const submission = await submitHomaSms(
    input.destinationPhoneE164,
    buildFamilySmsInvitationText(),
  );
  if (submission.status === "rejected") {
    await sql`
      update public.family_sms_invites
      set status = 'failed', responded_at = now()
      where id = ${prepared.invite.id} and status = 'sending'
    `;
    return { ok: false, reason: "sms-failed" };
  }
  if (submission.status === "unknown") {
    return { ok: false, reason: "sms-uncertain" };
  }
  const activated = await sql<{ id: string }[]>`
    update public.family_sms_invites
    set status = 'pending', provider_message_id = ${submission.messageId}
    where id = ${prepared.invite.id} and status = 'sending'
    returning id
  `;
  if (!activated[0]) return { ok: false, reason: "sms-uncertain" };

  await emitMapEvent("family.invite_sent", {
    family_id: input.familyId,
    channel: "sms",
  });
  return { ok: true };
}
