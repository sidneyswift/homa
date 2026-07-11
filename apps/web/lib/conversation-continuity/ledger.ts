import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  hashContinuityKey,
  resolveInboundTurn,
  type ContinuityChannel,
} from "./continuity-service";
import { PostgresContinuityRepository } from "./postgres-repository";
import { renderContinuityContext } from "./reply-policy";

export interface ContinuityAuthAttributes {
  familyId?: string;
  memberUserId?: string;
  episodeId?: string;
  taskRunId?: string;
  replyToMessageId?: string;
  repliedDeliveryId?: string;
  providerMessageId?: string;
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
  if (result.resolution !== "none") {
    await emitMapEvent("conversation.reply_resolved", {
      family_id: input.familyId,
      channel: input.channel,
      resolution: result.resolution,
      cross_channel:
        result.replySourceChannel !== null &&
        result.replySourceChannel !== input.channel,
    });
  }
  return result;
}

export function resolvedContinuityAttributes(
  result: Awaited<ReturnType<typeof resolveInboundContinuity>>,
  input: Pick<InboundContinuityInput, "memberUserId" | "providerMessageId">,
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
    ...(result.replyToMessageId
      ? { replyToMessageId: result.replyToMessageId }
      : {}),
    ...(result.repliedDeliveryId
      ? { repliedDeliveryId: result.repliedDeliveryId }
      : {}),
  };
}

export async function createProactiveEpisode(input: {
  familyId: string;
  now?: Date;
}): Promise<string> {
  return await new PostgresContinuityRepository().createEpisode({
    familyId: input.familyId,
    memberUserId: null,
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
): Promise<string> {
  const sql = mapDb();
  if (explicitEpisodeId) {
    const rows = await sql<{ id: string }[]>`
      select id from public.conversation_episodes
      where id = ${explicitEpisodeId} and family_id = ${familyId}
    `;
    if (rows[0]) {
      await new PostgresContinuityRepository().upsertBinding({
        familyId,
        memberUserId,
        channel,
        threadKeyHash:
          explicitThreadHash ?? hashContinuityKey(`${channel}:${sessionId}`),
        runtimeSessionId: sessionId,
        episodeId: rows[0].id,
        lastSeenAt: new Date(),
      });
      return rows[0].id;
    }
  }

  const bound = await sql<{ episode_id: string }[]>`
    select episode_id from public.conversation_thread_bindings
    where family_id = ${familyId} and runtime_session_id = ${sessionId}
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
  await repository.upsertBinding({
    familyId,
    memberUserId,
    channel,
    threadKeyHash:
      explicitThreadHash ?? hashContinuityKey(`${channel}:${sessionId}`),
    runtimeSessionId: sessionId,
    episodeId,
    lastSeenAt: new Date(),
  });
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
}

export function providerMessageIdForRole(
  role: PersistCanonicalMessageInput["role"],
  providerMessageId: string | null | undefined,
): string | null {
  return role === "user" ? (providerMessageId ?? null) : null;
}

export async function persistCanonicalMessage(
  input: PersistCanonicalMessageInput,
): Promise<{
  id: string;
  episodeId: string;
  replyClaimed: boolean;
} | null> {
  const attrs = (input.attributes ?? {}) as ContinuityAuthAttributes;
  const familyId = attrs.familyId;
  const content = input.content.trim().slice(0, 8000);
  if (!familyId || content.length === 0) return null;

  const memberUserId =
    input.role === "user" ? (attrs.memberUserId ?? null) : null;
  const episodeId = await episodeForRuntimeSession(
    familyId,
    memberUserId,
    input.channel,
    input.sessionId,
    attrs.episodeId ?? null,
    attrs.continuityThreadHash ?? null,
  );
  const providerMessageId = providerMessageIdForRole(
    input.role,
    input.providerMessageId ?? attrs.providerMessageId,
  );
  const sql = mapDb();
  // Dispatch output is promoted only after at least one real delivery
  // succeeds. Until then both its internal prompt and unsent narration stay
  // outside family-visible history.
  const visibility =
    input.channel === "dispatch" ||
    (input.role === "assistant" && input.terminal === false) ||
    (input.role === "assistant" &&
      (input.channel === "sms" || input.channel === "email"))
      ? "internal"
      : "family";
  return await sql.begin(async (tx) => {
    const duplicate = providerMessageId
      ? (
          await tx<{ id: string; episode_id: string | null }[]>`
            select id, episode_id from public.conversation_messages
            where family_id = ${familyId}
              and channel = ${input.channel}
              and provider_message_id = ${providerMessageId}
            limit 1
          `
        )[0]
      : null;
    const messageId =
      duplicate?.id ??
      (
        await tx<{ id: string }[]>`
          insert into public.conversation_messages
            (family_id, session_id, sequence, channel, role, content, turn_id,
             episode_id, member_user_id, visibility, task_run_id,
             provider_message_id, thread_key_hash)
          values
            (${familyId}, ${input.sessionId}, ${input.sequence}, ${input.channel},
             ${input.role}, ${content}, ${input.turnId ?? null}, ${episodeId},
             ${memberUserId}, ${visibility}, ${attrs.taskRunId ?? null},
             ${providerMessageId}, ${attrs.continuityThreadHash ?? null})
          on conflict
            (session_id, (coalesce(turn_id, '')), role, sequence)
          do update set
            episode_id = coalesce(public.conversation_messages.episode_id, excluded.episode_id),
            member_user_id = coalesce(public.conversation_messages.member_user_id, excluded.member_user_id),
            visibility = case
              when public.conversation_messages.visibility = 'family'
                or excluded.visibility = 'family'
              then 'family'
              else 'internal'
            end,
            task_run_id = coalesce(public.conversation_messages.task_run_id, excluded.task_run_id),
            provider_message_id = coalesce(public.conversation_messages.provider_message_id, excluded.provider_message_id),
            thread_key_hash = coalesce(public.conversation_messages.thread_key_hash, excluded.thread_key_hash)
          returning id
        `
      )[0].id;
    if (duplicate) {
      await tx`
        update public.conversation_messages
        set session_id = ${input.sessionId},
            sequence = ${input.sequence},
            turn_id = ${input.turnId ?? null},
            episode_id = coalesce(episode_id, ${episodeId}),
            member_user_id = coalesce(member_user_id, ${memberUserId}),
            thread_key_hash = coalesce(
              thread_key_hash,
              ${attrs.continuityThreadHash ?? null}
            )
        where id = ${messageId} and family_id = ${familyId}
      `;
    }

    await tx`
      update public.conversation_episodes
      set last_activity_at = now()
      where id = ${episodeId} and family_id = ${familyId}
    `;

    let replyClaimed = false;
    const repliedDeliveryId = attrs.repliedDeliveryId;
    if (repliedDeliveryId && input.role === "user") {
      const claimedLoop = await tx<{ id: string }[]>`
        update public.conversation_open_loops
        set state = 'resolved', resolved_at = now(),
            resolved_by_message_id = ${messageId}
        where delivery_id = ${repliedDeliveryId}
          and family_id = ${familyId} and state = 'open'
        returning id
      `;
      if (claimedLoop[0]) {
        replyClaimed = true;
        await tx`
          update public.conversation_deliveries
          set status = 'sent', sent_at = coalesce(sent_at, now()),
              replied_at = now(), reply_message_id = ${messageId},
              updated_at = now()
          where id = ${repliedDeliveryId} and family_id = ${familyId}
            and replied_at is null
        `;
        await tx`
          update public.conversation_messages
          set reply_to_message_id = ${attrs.replyToMessageId ?? null},
              replied_delivery_id = ${repliedDeliveryId}
          where id = ${messageId} and family_id = ${familyId}
        `;
        if (attrs.replyToMessageId) {
          await tx`
            update public.conversation_messages
            set visibility = 'family'
            where id = ${attrs.replyToMessageId}
              and family_id = ${familyId}
              and role = 'assistant'
          `;
        }
      }
    }

    return {
      id: messageId,
      episodeId: duplicate?.episode_id ?? episodeId,
      replyClaimed,
    };
  });
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
        order by last_seen_at desc
        limit 1
      `
    )[0]?.episode_id;
  if (!episodeId) return "";
  const messages = await new PostgresContinuityRepository().listEpisodeMessages(
    input.familyId,
    episodeId,
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
    null,
  );
  return renderContinuityContext(messages);
}
