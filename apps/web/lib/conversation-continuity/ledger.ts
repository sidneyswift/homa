import type { EventProps } from "@homa/core";
import type { TransactionSql } from "postgres";

import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import { isHiddenDirective } from "../onboarding/directives";
import {
  hashContinuityKey,
  resolveInboundTurn,
  type ContinuityChannel,
} from "./continuity-service";
import { PostgresContinuityRepository } from "./postgres-repository";
import {
  renderContinuityContext,
  type ReplyOutcome,
  type ReplyResolutionMethod,
} from "./reply-policy";

export interface ContinuityAuthAttributes {
  familyId?: string;
  memberUserId?: string;
  episodeId?: string;
  taskRunId?: string;
  replyToMessageId?: string;
  repliedDeliveryId?: string;
  resolvedOutcome?: ReplyOutcome;
  acceptedOfferDeliveryId?: string;
  resolutionMethod?: ReplyResolutionMethod;
  replyClassifierVersion?: string;
  providerMessageId?: string;
  providerReplyTo?: string;
  replySourceChannel?: "web" | "sms" | "email" | "dispatch";
  continuityThreadHash?: string;
  continuityContext?: string;
  channel?: string;
}

export interface InboundContinuityInput {
  familyId: string;
  memberUserId: string | null;
  channel: "web" | "sms" | "email";
  transportThreadKey: string;
  runtimeSessionId: string | null;
  providerMessageId: string | null;
  providerReplyTo: string | null;
  explicitDeliveryId?: string | null;
  destinationKey?: string | null;
  text: string;
  now?: Date;
}

export async function claimReplyResolutionWithTransaction(
  tx: TransactionSql,
  input: {
    familyId: string;
    memberUserId: string | null;
    destinationHash: string | null;
    deliveryId: string;
    messageId: string;
    replyToMessageId: string | null;
    outcome: ReplyOutcome | undefined;
    resolutionMethod: ReplyResolutionMethod | undefined;
    classifierVersion: string | undefined;
  },
): Promise<boolean> {
  const claimedLoop = await tx<{ id: string }[]>`
    update public.conversation_open_loops
    set state = 'resolved', resolved_at = now(),
        resolved_by_message_id = ${input.messageId},
        resolved_outcome = ${input.outcome ?? null},
        resolution_method = ${input.resolutionMethod ?? null},
        classifier_version = ${input.classifierVersion ?? null}
    where delivery_id = ${input.deliveryId}
      and family_id = ${input.familyId} and state = 'open'
      and ${input.memberUserId}::uuid is not null
      and exists (
        select 1
        from public.family_members current_member
        where current_member.family_id = ${input.familyId}
          and current_member.user_id = ${input.memberUserId}
      )
      and exists (
        select 1
        from public.conversation_deliveries claimed_delivery
        where claimed_delivery.id = conversation_open_loops.delivery_id
          and claimed_delivery.family_id = conversation_open_loops.family_id
          and (
            claimed_delivery.recipient_member_user_id = ${input.memberUserId}
            or (
              claimed_delivery.recipient_member_user_id is null
              and ${input.destinationHash}::text is not null
              and claimed_delivery.destination_hash = ${input.destinationHash}
            )
          )
          and (
            ${input.replyToMessageId}::uuid is null
            or claimed_delivery.message_id = ${input.replyToMessageId}
          )
          and exists (
            select 1
            from public.conversation_messages reply_message
            where reply_message.id = ${input.messageId}
              and reply_message.family_id = claimed_delivery.family_id
              and reply_message.episode_id = claimed_delivery.episode_id
              and reply_message.role = 'user'
              and reply_message.member_user_id = ${input.memberUserId}
          )
      )
    returning id
  `;
  if (!claimedLoop[0]) return false;

  await tx`
    update public.conversation_deliveries
    set status = 'sent', sent_at = coalesce(sent_at, now()),
        replied_at = now(), reply_message_id = ${input.messageId},
        updated_at = now()
    where id = ${input.deliveryId} and family_id = ${input.familyId}
      and replied_at is null
      and (
        recipient_member_user_id = ${input.memberUserId}
        or (
          recipient_member_user_id is null
          and ${input.destinationHash}::text is not null
          and destination_hash = ${input.destinationHash}
        )
      )
  `;
  await tx`
    update public.conversation_messages
    set reply_to_message_id = ${input.replyToMessageId},
        replied_delivery_id = ${input.deliveryId}
    where id = ${input.messageId} and family_id = ${input.familyId}
      and member_user_id = ${input.memberUserId}
  `;
  if (input.replyToMessageId) {
    await tx`
      update public.conversation_messages
      set visibility = 'family'
      where id = ${input.replyToMessageId}
        and family_id = ${input.familyId}
        and role = 'assistant'
        and exists (
          select 1
          from public.conversation_deliveries own_delivery
          where own_delivery.id = ${input.deliveryId}
            and own_delivery.family_id = conversation_messages.family_id
            and own_delivery.message_id = conversation_messages.id
            and (
              own_delivery.recipient_member_user_id = ${input.memberUserId}
              or (
                own_delivery.recipient_member_user_id is null
                and ${input.destinationHash}::text is not null
                and own_delivery.destination_hash = ${input.destinationHash}
              )
            )
        )
    `;
  }
  return true;
}

type ReplyResolvedEventEmitter = (
  name: "conversation.reply_resolved",
  props: EventProps<"conversation.reply_resolved">,
) => Promise<void>;

export async function emitClaimedReplyResolvedEvent(
  input: {
    replyClaimed: boolean;
    familyId: string;
    channel: "web" | "sms" | "email";
    resolvedOutcome: ReplyOutcome | undefined;
    resolutionMethod: ReplyResolutionMethod | undefined;
    classifierVersion: string | undefined;
    replySourceChannel: "web" | "sms" | "email" | "dispatch" | undefined;
  },
  emit?: ReplyResolvedEventEmitter,
): Promise<void> {
  if (!input.replyClaimed || !input.resolvedOutcome) return;
  const props: EventProps<"conversation.reply_resolved"> = {
    family_id: input.familyId,
    channel: input.channel,
    resolution: "matched",
    resolved_outcome: input.resolvedOutcome,
    cross_channel:
      input.replySourceChannel !== undefined &&
      input.replySourceChannel !== input.channel,
    ...(input.resolutionMethod
      ? { resolution_method: input.resolutionMethod }
      : {}),
    ...(input.classifierVersion
      ? { classifier_version: input.classifierVersion }
      : {}),
  };
  if (emit) {
    await emit("conversation.reply_resolved", props);
    return;
  }
  await emitMapEvent("conversation.reply_resolved", props);
}

export async function resolveInboundContinuity(
  input: InboundContinuityInput,
) {
  const result = await resolveInboundTurn(new PostgresContinuityRepository(), {
    familyId: input.familyId,
    memberUserId: input.memberUserId,
    channel: input.channel,
    transportThreadKey: input.transportThreadKey,
    runtimeSessionId: input.runtimeSessionId,
    providerReplyTo: input.providerReplyTo,
    explicitDeliveryId: input.explicitDeliveryId ?? null,
    destinationKey: input.destinationKey ?? null,
    text: input.text,
    now: input.now ?? new Date(),
  });
  return result;
}

export function resolvedContinuityAttributes(
  result: Awaited<ReturnType<typeof resolveInboundContinuity>>,
  input: Pick<InboundContinuityInput, "memberUserId" | "providerMessageId"> & {
    providerReplyTo?: string | null;
  },
): Record<string, string> {
  return {
    episodeId: result.episodeId,
    continuityThreadHash: result.threadKeyHash,
    ...(result.contextMarkdown
      ? { continuityContext: result.contextMarkdown }
      : {}),
    ...(input.memberUserId ? { memberUserId: input.memberUserId } : {}),
    ...(input.providerMessageId
      ? { providerMessageId: input.providerMessageId }
      : {}),
    ...(input.providerReplyTo
      ? { providerReplyTo: input.providerReplyTo }
      : {}),
    ...(result.replyToMessageId
      ? { replyToMessageId: result.replyToMessageId }
      : {}),
    ...(result.repliedDeliveryId
      ? { repliedDeliveryId: result.repliedDeliveryId }
      : {}),
    ...(result.resolvedOutcome
      ? { resolvedOutcome: result.resolvedOutcome }
      : {}),
    ...(result.acceptedOfferDeliveryId
      ? { acceptedOfferDeliveryId: result.acceptedOfferDeliveryId }
      : {}),
    ...(result.resolutionMethod
      ? { resolutionMethod: result.resolutionMethod }
      : {}),
    ...(result.replyClassifierVersion
      ? { replyClassifierVersion: result.replyClassifierVersion }
      : {}),
    ...(result.replySourceChannel
      ? { replySourceChannel: result.replySourceChannel }
      : {}),
  };
}

export async function createProactiveEpisode(input: {
  familyId: string;
  memberUserId?: string | null;
  now?: Date;
}): Promise<string> {
  return await new PostgresContinuityRepository().createEpisode({
    familyId: input.familyId,
    memberUserId: input.memberUserId ?? null,
    now: input.now ?? new Date(),
  });
}

async function episodeForRuntimeSession(
  familyId: string,
  memberUserId: string | null,
  channel: ContinuityChannel,
  sessionId: string,
  explicitEpisodeId: string | null,
  explicitThreadHash: string | null,
  preserveExistingBinding: boolean,
  useDatabaseClock: boolean,
): Promise<string> {
  const sql = mapDb();
  if (explicitEpisodeId) {
    const rows = await sql<{ id: string }[]>`
      select id from public.conversation_episodes
      where id = ${explicitEpisodeId} and family_id = ${familyId}
        and (
          (${memberUserId}::uuid is not null and (
            exists (
              select 1
              from public.family_members current_member
              where current_member.family_id = conversation_episodes.family_id
                and current_member.user_id = ${memberUserId}
            )
            and (
              member_user_id = ${memberUserId}
              or exists (
                select 1 from public.conversation_deliveries delivery
                where delivery.episode_id = conversation_episodes.id
                  and delivery.family_id = conversation_episodes.family_id
                  and delivery.recipient_member_user_id = ${memberUserId}
                  and delivery.status = 'sent'
              )
              or (
                member_user_id is null
                and not exists (
                  select 1
                  from public.conversation_messages episode_message
                  where episode_message.family_id =
                        conversation_episodes.family_id
                    and episode_message.episode_id = conversation_episodes.id
                )
                and not exists (
                  select 1
                  from public.conversation_deliveries episode_delivery
                  where episode_delivery.family_id =
                        conversation_episodes.family_id
                    and episode_delivery.episode_id = conversation_episodes.id
                )
              )
            )
          ))
          or (${memberUserId}::uuid is null and ${channel} = 'dispatch'
              and scope = 'member' and member_user_id is null)
        )
    `;
    if (rows[0]) {
      await new PostgresContinuityRepository().upsertBinding(
        {
          familyId,
          memberUserId,
          channel,
          threadKeyHash:
            explicitThreadHash ?? hashContinuityKey(`${channel}:${sessionId}`),
          runtimeSessionId: sessionId,
          episodeId: rows[0].id,
          lastSeenAt: new Date(),
        },
        { preserveExistingBinding, useDatabaseClock },
      );
      return rows[0].id;
    }
  }

  const bound = await sql<{ episode_id: string }[]>`
    select episode_id from public.conversation_thread_bindings
    where family_id = ${familyId} and runtime_session_id = ${sessionId}
      and member_user_id is not distinct from ${memberUserId}
      and (
        ${memberUserId}::uuid is null
        or exists (
          select 1
          from public.family_members current_member
          where current_member.family_id =
                public.conversation_thread_bindings.family_id
            and current_member.user_id = ${memberUserId}
        )
      )
    order by last_seen_at desc
    limit 1
  `;
  if (bound[0]) return bound[0].episode_id;

  const repository = new PostgresContinuityRepository();
  const episodeId =
    (await repository.findRecentEpisode({
      familyId,
      memberUserId,
      now: new Date(),
    })) ??
    (await repository.createEpisode({
      familyId,
      memberUserId,
      now: new Date(),
    }));
  await repository.upsertBinding(
    {
      familyId,
      memberUserId,
      channel,
      threadKeyHash:
        explicitThreadHash ?? hashContinuityKey(`${channel}:${sessionId}`),
      runtimeSessionId: sessionId,
      episodeId,
      lastSeenAt: new Date(),
    },
    { preserveExistingBinding, useDatabaseClock },
  );
  return episodeId;
}

export interface PersistCanonicalMessageInput {
  attributes: unknown;
  sessionId: string;
  channel: "web" | "sms" | "email" | "dispatch";
  sequence: number;
  role: "user" | "assistant";
  content: string;
  turnId: string | undefined;
  providerMessageId?: string | null;
  terminal?: boolean;
  /** How the turn arrived. Defaults to text; in-app voice writes "voice" so
   * the thread can render it as spoken and the per-turn context can tell
   * Homa what was said aloud without claiming she read it. The channel stays
   * "web" for in-app voice, because that is where it happened. */
  modality?: "text" | "voice";
}

export function providerMessageIdForRole(
  role: PersistCanonicalMessageInput["role"],
  providerMessageId: string | null | undefined,
): string | null {
  return role === "user" ? (providerMessageId ?? null) : null;
}

/**
 * canonicalMessageVisibility(input): whether a row joins family-visible
 * history or stays internal.
 *
 * Three reasons a row stays internal:
 * - Dispatch output is promoted only after at least one real delivery
 *   succeeds. Until then both its internal prompt and unsent narration
 *   stay outside family-visible history.
 * - A non-terminal assistant row, and any assistant row on SMS or email,
 *   is machinery rather than the message that reached her.
 * - A hidden onboarding directive (lib/onboarding/directives.ts) is the
 *   app talking on her behalf. She never typed it and never sees it, so
 *   it must not appear in her scrollback, in recall, or in the founder
 *   console. The row still exists: turn recovery matches against it.
 */
export function canonicalMessageVisibility(input: {
  channel: PersistCanonicalMessageInput["channel"];
  role: PersistCanonicalMessageInput["role"];
  terminal: boolean | undefined;
  content: string;
}): "family" | "internal" {
  if (input.channel === "dispatch") return "internal";
  if (input.role === "assistant") {
    if (input.terminal === false) return "internal";
    if (input.channel === "sms" || input.channel === "email") return "internal";
    return "family";
  }
  if (isHiddenDirective(input.content)) return "internal";
  return "family";
}

export async function persistCanonicalMessage(
  input: PersistCanonicalMessageInput,
): Promise<{
  id: string;
  episodeId: string;
  replyClaimed: boolean;
  content: string;
} | null> {
  const attrs = (input.attributes ?? {}) as ContinuityAuthAttributes;
  const familyId = attrs.familyId;
  const content = input.content.trim().slice(0, 8000);
  if (!familyId || content.length === 0) return null;

  const memberUserId = attrs.memberUserId ?? null;
  const episodeId = await episodeForRuntimeSession(
    familyId,
    memberUserId,
    input.channel,
    input.sessionId,
    attrs.episodeId ?? null,
    attrs.continuityThreadHash ?? null,
    input.role === "assistant" || typeof attrs.episodeId === "string",
    true,
  );
  const providerMessageId = providerMessageIdForRole(
    input.role,
    input.providerMessageId ?? attrs.providerMessageId,
  );
  const sql = mapDb();
  const visibility = canonicalMessageVisibility({
    channel: input.channel,
    role: input.role,
    terminal: input.terminal,
    content,
  });
  const modality = input.modality === "voice" ? "voice" : "text";
  const persisted = await sql.begin(async (tx) => {
    const duplicate = providerMessageId
      ? (
          await tx<{ id: string; episode_id: string | null; content: string }[]>`
            select id, episode_id, content from public.conversation_messages
            where family_id = ${familyId}
              and channel = ${input.channel}
              and provider_message_id = ${providerMessageId}
            limit 1
          `
        )[0]
      : null;
    const storedMessage =
      duplicate ??
      (
        await tx<{ id: string; content: string }[]>`
          insert into public.conversation_messages
            (family_id, session_id, sequence, channel, role, content, turn_id,
             episode_id, member_user_id, visibility, task_run_id,
             provider_message_id, thread_key_hash, modality)
          values
            (${familyId}, ${input.sessionId}, ${input.sequence}, ${input.channel},
             ${input.role}, ${content}, ${input.turnId ?? null}, ${episodeId},
             ${memberUserId}, ${visibility}, ${attrs.taskRunId ?? null},
             ${providerMessageId}, ${attrs.continuityThreadHash ?? null},
             ${modality})
          on conflict
            (session_id, (coalesce(turn_id, '')), role, sequence)
          do update set
            content = case
              when ${input.role === "assistant" && input.terminal === true}
                then excluded.content
              else public.conversation_messages.content
            end,
            created_at = case
              when ${input.role === "assistant" && input.terminal === true}
                then excluded.created_at
              else public.conversation_messages.created_at
            end,
            embedding = case
              when ${input.role === "assistant" && input.terminal === true}
                and public.conversation_messages.content is distinct from excluded.content
                then null
              else public.conversation_messages.embedding
            end,
            episode_id = coalesce(
              public.conversation_messages.episode_id,
              excluded.episode_id
            ),
            member_user_id = coalesce(
              public.conversation_messages.member_user_id,
              excluded.member_user_id
            ),
            visibility = case
              when public.conversation_messages.visibility = 'family'
                or excluded.visibility = 'family'
              then 'family'
              else 'internal'
            end,
            task_run_id = coalesce(
              public.conversation_messages.task_run_id,
              excluded.task_run_id
            ),
            provider_message_id = coalesce(
              public.conversation_messages.provider_message_id,
              excluded.provider_message_id
            ),
            thread_key_hash = coalesce(
              public.conversation_messages.thread_key_hash,
              excluded.thread_key_hash
            ),
            modality = case
              when excluded.modality = 'voice' then 'voice'
              else public.conversation_messages.modality
            end
          returning id, content
        `
      )[0];
    const messageId = storedMessage.id;
    if (duplicate) {
      await tx`
        update public.conversation_messages
        set session_id = ${input.sessionId},
            sequence = ${input.sequence},
            turn_id = ${input.turnId ?? null},
            episode_id = coalesce(episode_id, ${episodeId}),
            member_user_id = coalesce(member_user_id, ${memberUserId}),
            modality = case
              when ${modality} = 'voice' then 'voice'
              else modality
            end,
            thread_key_hash = coalesce(
              thread_key_hash,
              ${attrs.continuityThreadHash ?? null}
            )
        where id = ${messageId} and family_id = ${familyId}
      `;
    }

    await tx`
      update public.conversation_episodes
      set last_activity_at = now(),
          member_user_id = case
            when ${input.role} = 'user' then ${memberUserId}
            else member_user_id
          end,
          scope = 'member'
      where id = ${episodeId} and family_id = ${familyId}
    `;

    let replyClaimed = false;
    const repliedDeliveryId = attrs.repliedDeliveryId;
    if (repliedDeliveryId && input.role === "user") {
      replyClaimed = await claimReplyResolutionWithTransaction(tx, {
        familyId,
        memberUserId,
        destinationHash: null,
        deliveryId: repliedDeliveryId,
        messageId,
        replyToMessageId: attrs.replyToMessageId ?? null,
        outcome: attrs.resolvedOutcome,
        resolutionMethod: attrs.resolutionMethod,
        classifierVersion: attrs.replyClassifierVersion,
      });
    }

    return {
      id: messageId,
      episodeId: duplicate?.episode_id ?? episodeId,
      replyClaimed,
      content: storedMessage.content,
    };
  });
  if (input.channel !== "dispatch") {
    await emitClaimedReplyResolvedEvent({
      replyClaimed: persisted.replyClaimed,
      familyId,
      channel: input.channel,
      resolvedOutcome: attrs.resolvedOutcome,
      resolutionMethod: attrs.resolutionMethod,
      classifierVersion: attrs.replyClassifierVersion,
      replySourceChannel: attrs.replySourceChannel,
    });
  }
  return persisted;
}

export async function markCanonicalMessageDelivered(input: {
  familyId: string;
  messageId: string;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.conversation_messages
    set visibility = 'family'
    where id = ${input.messageId}
      and family_id = ${input.familyId}
      and role = 'assistant'
  `;
}

export async function loadContinuityContext(input: {
  familyId: string;
  memberUserId: string | null;
  episodeId?: string | null;
  runtimeSessionId: string;
}): Promise<string> {
  const sql = mapDb();
  const episodeId =
    input.episodeId ??
    (
      await sql<{ episode_id: string }[]>`
        select episode_id from public.conversation_thread_bindings
        where family_id = ${input.familyId}
          and runtime_session_id = ${input.runtimeSessionId}
          and member_user_id is not distinct from ${input.memberUserId}
          and ${input.memberUserId}::uuid is not null
          and exists (
            select 1
            from public.family_members current_member
            where current_member.family_id =
                  public.conversation_thread_bindings.family_id
              and current_member.user_id = ${input.memberUserId}
          )
        order by last_seen_at desc
        limit 1
      `
    )[0]?.episode_id;
  if (!episodeId) return "";
  const messages = await new PostgresContinuityRepository().listEpisodeMessages(
    input.familyId,
    episodeId,
    input.memberUserId,
    input.runtimeSessionId,
  );
  return renderContinuityContext(messages);
}

export async function loadRecentContinuityForMember(input: {
  familyId: string;
  memberUserId: string | null;
}): Promise<string> {
  const repository = new PostgresContinuityRepository();
  const episodeId = await repository.findRecentEpisode({
    familyId: input.familyId,
    memberUserId: input.memberUserId,
    now: new Date(),
  });
  if (!episodeId) return "";
  const messages = await repository.listEpisodeMessages(
    input.familyId,
    episodeId,
    input.memberUserId,
    null,
  );
  return renderContinuityContext(messages);
}
