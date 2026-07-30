import { mapDb } from "../map/db";
import type {
  ContinuityChannel,
  ContinuityRepository,
  EpisodeBinding,
  EpisodeMessage,
} from "./continuity-service";
import type { PendingDeliveryCandidate } from "./reply-policy";

/**
 * Postgres adapter for the Conversation Continuity module. The interface is
 * also implemented by an in-memory fake in tests; channel adapters know only
 * the interface, never this schema.
 */
export class PostgresContinuityRepository implements ContinuityRepository {
  async listPendingDeliveries(input: {
    familyId: string;
    memberUserId: string | null;
    destinationHash: string | null;
    now: Date;
  }): Promise<PendingDeliveryCandidate[]> {
    const sql = mapDb();
    const rows = await sql<
      {
        delivery_id: string;
        episode_id: string;
        message_id: string;
        recipient_member_user_id: string | null;
        channel: PendingDeliveryCandidate["channel"];
        provider_message_id: string | null;
        sent_at: string;
        expires_at: string;
        kind: PendingDeliveryCandidate["replyKind"];
        destination_authenticated: boolean;
        content: string;
        prompt_key: string | null;
      }[]
    >`
      select d.id as delivery_id, d.episode_id, d.message_id,
             d.recipient_member_user_id, d.channel, d.provider_message_id,
             coalesce(d.sent_at, d.created_at)::text as sent_at,
             l.expires_at::text as expires_at, l.kind,
             (
               ${input.destinationHash}::text is not null
               and d.destination_hash = ${input.destinationHash}
             ) as destination_authenticated,
             m.content, l.prompt_key
      from public.conversation_open_loops l
      join public.conversation_deliveries d on d.id = l.delivery_id
      join public.conversation_messages m on m.id = l.message_id
      where l.family_id = ${input.familyId}
        and l.state = 'open'
        and l.expires_at > ${input.now.toISOString()}
        and (
          d.status in ('sent', 'uncertain')
          or (
            d.status = 'pending'
            and d.created_at > ${new Date(input.now.getTime() - 2 * 60_000).toISOString()}
          )
        )
        and d.replied_at is null
        and (
          (${input.memberUserId}::uuid is not null
           and d.recipient_member_user_id = ${input.memberUserId})
          or
          (${input.destinationHash}::text is not null
           and d.destination_hash = ${input.destinationHash})
        )
      order by d.sent_at desc
      limit 10
    `;
    return rows.map((row) => ({
      deliveryId: row.delivery_id,
      episodeId: row.episode_id,
      messageId: row.message_id,
      recipientMemberUserId: row.recipient_member_user_id,
      channel: row.channel,
      providerMessageId: row.provider_message_id,
      sentAt: new Date(row.sent_at),
      expiresAt: new Date(row.expires_at),
      replyKind: row.kind,
      destinationAuthenticated: row.destination_authenticated,
      messageContent: row.content,
      promptKey: row.prompt_key,
    }));
  }

  async findBinding(
    familyId: string,
    channel: ContinuityChannel,
    threadKeyHash: string,
  ): Promise<EpisodeBinding | null> {
    const sql = mapDb();
    const rows = await sql<
      {
        family_id: string;
        member_user_id: string | null;
        channel: ContinuityChannel;
        thread_key_hash: string;
        runtime_session_id: string | null;
        episode_id: string;
        pending_offer_delivery_id: string | null;
        last_seen_at: string;
      }[]
    >`
      select family_id, member_user_id, channel, thread_key_hash,
             runtime_session_id, episode_id, pending_offer_delivery_id,
             last_seen_at::text as last_seen_at
      from public.conversation_thread_bindings
      where family_id = ${familyId}
        and channel = ${channel} and thread_key_hash = ${threadKeyHash}
      limit 1
    `;
    const row = rows[0];
    return row
      ? {
          familyId: row.family_id,
          memberUserId: row.member_user_id,
          channel: row.channel,
          threadKeyHash: row.thread_key_hash,
          runtimeSessionId: row.runtime_session_id,
          episodeId: row.episode_id,
          pendingOfferDeliveryId: row.pending_offer_delivery_id,
          lastSeenAt: new Date(row.last_seen_at),
        }
      : null;
  }

  async findRecentEpisode(input: {
    familyId: string;
    memberUserId: string | null;
    now: Date;
  }): Promise<string | null> {
    const sql = mapDb();
    const rows = await sql<{ id: string }[]>`
      select e.id
      from public.conversation_episodes e
      where e.family_id = ${input.familyId}
        and e.status = 'open'
        and (
          exists (
            select 1
            from public.conversation_deliveries d
            join public.conversation_open_loops l on l.delivery_id = d.id
            where d.episode_id = e.id
              and d.family_id = e.family_id
              and d.recipient_member_user_id is not distinct from ${input.memberUserId}
              and l.state = 'open'
              and l.expires_at > ${input.now.toISOString()}
          )
          or e.last_activity_at > ${new Date(input.now.getTime() - 30 * 60_000).toISOString()}
        )
      order by
        exists (
          select 1
          from public.conversation_deliveries d
          join public.conversation_open_loops l on l.delivery_id = d.id
          where d.episode_id = e.id
            and d.family_id = e.family_id
            and d.recipient_member_user_id is not distinct from ${input.memberUserId}
            and l.state = 'open'
            and l.expires_at > ${input.now.toISOString()}
        ) desc,
        e.last_activity_at desc
      limit 1
    `;
    return rows[0]?.id ?? null;
  }

  async createEpisode(input: {
    familyId: string;
    memberUserId: string | null;
    now: Date;
  }): Promise<string> {
    const sql = mapDb();
    const rows = await sql<{ id: string }[]>`
      insert into public.conversation_episodes
        (family_id, scope, opened_at, last_activity_at)
      values
        (${input.familyId}, 'household', ${input.now.toISOString()},
         ${input.now.toISOString()})
      returning id
    `;
    return rows[0].id;
  }

  async upsertBinding(binding: EpisodeBinding): Promise<void> {
    const sql = mapDb();
    await sql`
      insert into public.conversation_thread_bindings
        (family_id, member_user_id, channel, thread_key_hash,
         runtime_session_id, episode_id, pending_offer_delivery_id,
         last_seen_at)
      values
        (${binding.familyId}, ${binding.memberUserId}, ${binding.channel},
         ${binding.threadKeyHash}, ${binding.runtimeSessionId},
         ${binding.episodeId}, ${binding.pendingOfferDeliveryId ?? null},
         ${binding.lastSeenAt.toISOString()})
      on conflict (channel, thread_key_hash) do update
      set family_id = excluded.family_id,
          member_user_id = excluded.member_user_id,
          runtime_session_id = excluded.runtime_session_id,
          episode_id = excluded.episode_id,
          pending_offer_delivery_id = coalesce(
            excluded.pending_offer_delivery_id,
            public.conversation_thread_bindings.pending_offer_delivery_id
          ),
          last_seen_at = excluded.last_seen_at
    `;
  }

  async listEpisodeMessages(
    familyId: string,
    episodeId: string,
    excludeRuntimeSessionId: string | null,
  ): Promise<EpisodeMessage[]> {
    const sql = mapDb();
    const rows = await sql<
      {
        role: "user" | "assistant";
        visibility: "family" | "internal";
        content: string;
        created_at: string;
        session_id: string;
        modality: string | null;
        display_name: string | null;
        recipient_names: string[];
      }[]
    >`
      select recent.role, recent.visibility, recent.content,
             recent.created_at::text as created_at, recent.session_id,
             recent.modality,
             member.display_name,
             coalesce(
               (
                 select array_agg(
                   coalesce(recipient.display_name, 'the family')
                   order by delivery.created_at
                 )
                 from public.conversation_deliveries delivery
                 left join public.family_members recipient
                   on recipient.family_id = delivery.family_id
                  and recipient.user_id = delivery.recipient_member_user_id
                 where delivery.message_id = recent.id
                   and delivery.status = 'sent'
               ),
               '{}'
             ) as recipient_names
      from (
        select id, role, visibility, content, created_at, session_id,
               member_user_id, modality
        from public.conversation_messages
        where family_id = ${familyId}
          and episode_id = ${episodeId}
          and (
            ${excludeRuntimeSessionId}::text is null
            or session_id != ${excludeRuntimeSessionId}
          )
        order by created_at desc
        limit 12
      ) recent
      left join public.family_members member
        on member.family_id = ${familyId}
       and member.user_id = recent.member_user_id
      order by created_at
    `;
    return rows.map((row) => ({
      role: row.role,
      visibility: row.visibility,
      content: row.content,
      happenedAt: new Date(row.created_at),
      runtimeSessionId: row.session_id,
      memberName: row.display_name,
      recipientNames: row.recipient_names,
      modality: row.modality === "voice" ? "voice" : "text",
    }));
  }
}
