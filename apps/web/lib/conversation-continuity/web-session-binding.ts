import { mapDb } from "../map/db";
import { hashContinuityKey, type EpisodeBinding } from "./continuity-service";

export interface WebSessionBinding {
  runtimeSessionId: string;
  lastSeenAtMs: number;
  latestSequence: number | null;
  latestUserMessageAtMs: number | null;
}

export function webSessionThreadHash(memberUserId: string): string {
  return hashContinuityKey(`web:${memberUserId}`);
}

export function clientWebSessionBinding(
  binding: EpisodeBinding | null,
  memberUserId: string,
  latestSequence: number | null,
  latestUserMessageAtMs: number | null,
): WebSessionBinding | null {
  if (
    binding?.channel !== "web" ||
    (binding.memberUserId !== null && binding.memberUserId !== memberUserId) ||
    !binding.runtimeSessionId
  ) {
    return null;
  }
  const legacyLastSeenAtMs =
    binding.memberUserId === null &&
    latestSequence !== null &&
    latestUserMessageAtMs !== null &&
    latestUserMessageAtMs < binding.lastSeenAt.getTime()
      ? latestUserMessageAtMs
      : binding.lastSeenAt.getTime();
  return {
    runtimeSessionId: binding.runtimeSessionId,
    lastSeenAtMs: legacyLastSeenAtMs,
    latestSequence,
    latestUserMessageAtMs,
  };
}

/**
 * Reads the authenticated adult's stable web binding. The caller derives both
 * ids from server-side auth; the queries repeat family, channel, hashed
 * principal, and runtime-session checks before returning a cursor witness.
 * The member column may be null on a legacy binding because assistant
 * persistence historically cleared it. A non-null member must still match.
 * No transcript content crosses this endpoint.
 */
export async function readWebSessionBinding(input: {
  familyId: string;
  memberUserId: string;
}): Promise<WebSessionBinding | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      member_user_id: string | null;
      runtime_session_id: string | null;
      episode_id: string;
      last_seen_at: string;
      latest_sequence: number | null;
      latest_user_message_at: string | null;
    }[]
  >`
    select binding.member_user_id,
           binding.runtime_session_id,
           binding.episode_id,
           binding.last_seen_at::text as last_seen_at,
           latest.sequence as latest_sequence,
           latest.created_at::text as latest_user_message_at
    from public.conversation_thread_bindings binding
    left join lateral (
      select message.sequence, message.created_at
      from public.conversation_messages message
      where message.family_id = ${input.familyId}
        and message.member_user_id = ${input.memberUserId}
        and message.channel = 'web'
        and message.role = 'user'
        and message.session_id = binding.runtime_session_id
      order by message.sequence desc
      limit 1
    ) latest on true
    where binding.family_id = ${input.familyId}
      and binding.channel = 'web'
      and binding.thread_key_hash = ${webSessionThreadHash(input.memberUserId)}
      and (
        binding.member_user_id = ${input.memberUserId}
        or binding.member_user_id is null
      )
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return clientWebSessionBinding(
    {
      familyId: input.familyId,
      memberUserId: row.member_user_id,
      channel: "web",
      threadKeyHash: webSessionThreadHash(input.memberUserId),
      runtimeSessionId: row.runtime_session_id,
      episodeId: row.episode_id,
      lastSeenAt: new Date(row.last_seen_at),
    },
    input.memberUserId,
    row.latest_sequence,
    row.latest_user_message_at
      ? Date.parse(row.latest_user_message_at)
      : null,
  );
}
