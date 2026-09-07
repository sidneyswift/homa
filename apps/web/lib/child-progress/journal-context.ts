import { z } from "zod";

import { mapDb } from "../map/db";

const uuid = z.string().uuid();
export interface JournalContextRequest {
  familyId: string;
  memberUserId: string | null;
  runtimeSessionId: string;
  inboundMessageId: string;
  message: string;
  channel: "web" | "sms" | "email";
}
export interface PreviousJournalAssistant {
  messageId: string;
  text: string;
  createdAt: string;
}
interface PreviousRow {
  id: string;
  role: string;
  visibility: string;
  member_user_id: string | null;
  channel: string;
  content: string;
  created_at: string;
  delivered_to_actor: boolean;
}

/** A tie or unavailable immediate predecessor is not permission to reach farther back. */
export function verifiedJournalPredecessor(
  rows: readonly PreviousRow[],
  request: JournalContextRequest,
): PreviousJournalAssistant | null {
  const row = rows[0];
  if (!row || rows.length > 2 || !uuid.safeParse(row.id).success || row.role !== "assistant" || row.visibility !== "family" || row.member_user_id !== request.memberUserId || row.channel !== request.channel || !row.content.trim() || Array.from(row.content).length > 2_000 || !Number.isFinite(Date.parse(row.created_at)) || rows[1]?.created_at === row.created_at) return null;
  if (request.channel !== "web" && !row.delivered_to_actor) return null;
  return { messageId: row.id, text: row.content, createdAt: row.created_at };
}

/** Read-only, current-message-bound context. Model input cannot supply previous text or identity. */
export async function loadJournalConversationContext(
  request: JournalContextRequest,
  database?: ReturnType<typeof mapDb>,
): Promise<PreviousJournalAssistant | null> {
  if (!uuid.safeParse(request.familyId).success || !uuid.safeParse(request.memberUserId).success || !uuid.safeParse(request.inboundMessageId).success || !request.runtimeSessionId || request.runtimeSessionId.length > 200 || !request.message || Array.from(request.message).length > 8_000 || !["web", "sms", "email"].includes(request.channel)) return null;
  try {
    const sql = database ?? mapDb();
    const pending = sql<PreviousRow[]>`
      with inbound as (
        select current_message.created_at, current_message.session_id
        from public.conversation_messages current_message
        where current_message.id = ${request.inboundMessageId}::uuid
          and current_message.family_id = ${request.familyId}::uuid
          and current_message.session_id = ${request.runtimeSessionId}
          and current_message.member_user_id = ${request.memberUserId}::uuid
          and current_message.channel = ${request.channel}
          and current_message.role = 'user'
          and current_message.visibility = 'family'
          and current_message.content = ${request.message}
          and exists (
            select 1 from public.family_members member
            where member.family_id = current_message.family_id
              and member.user_id = ${request.memberUserId}::uuid
          )
          and not exists (
            select 1 from public.conversation_messages other_user
            where other_user.family_id = current_message.family_id
              and other_user.session_id = current_message.session_id
              and other_user.role = 'user'
              and other_user.member_user_id is distinct from ${request.memberUserId}::uuid
          )
          and not exists (
            select 1 from public.conversation_messages tied
            where tied.family_id = current_message.family_id
              and tied.session_id = current_message.session_id
              and tied.created_at = current_message.created_at
              and tied.id <> current_message.id
          )
      )
      select previous.id, previous.role, previous.visibility,
             previous.member_user_id, previous.channel,
             left(previous.content, 2001) as content,
             previous.created_at::text as created_at,
             exists (
               select 1 from public.conversation_deliveries delivery
               where delivery.family_id = ${request.familyId}::uuid
                 and delivery.message_id = previous.id
                 and delivery.recipient_member_user_id = ${request.memberUserId}::uuid
                 and delivery.channel = ${request.channel}
                 and delivery.status = 'sent'
             ) as delivered_to_actor
      from inbound
      cross join lateral (
        select message.id, message.role, message.visibility,
               message.member_user_id, message.channel, message.content,
               message.created_at
        from public.conversation_messages message
        where message.family_id = ${request.familyId}::uuid
          and message.session_id = inbound.session_id
          and message.created_at < inbound.created_at
        order by message.created_at desc
        limit 2
      ) previous
      order by previous.created_at desc
    `;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const rows = await Promise.race([
        pending,
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => {
            try { pending.cancel(); }
            catch { /* A failed cancellation still cannot supply context. */ }
            reject(new Error("Journal context lookup timed out"));
          }, 2_000);
        }),
      ]);
      return verifiedJournalPredecessor(rows, request);
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  } catch {
    // Context is optional. Never expose database details or guess older context.
    return null;
  }
}
