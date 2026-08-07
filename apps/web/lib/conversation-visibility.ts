import type { Sql } from "postgres";

export interface ExportedConversationMessage {
  content: string;
  [key: string]: unknown;
}

export interface AdultSessionReviewMessage {
  sequence: number;
  role: "user" | "assistant";
  content: string;
}

interface AdultConversationScope {
  familyId: string;
  memberUserId: string;
}

/**
 * Service-role reads do not receive the caller's RLS policy automatically.
 * Keep their message boundary in one fragment so account export and ambient
 * review cannot drift apart: parent-visible rows owned by this adult, plus
 * rows with a successful delivery to this exact adult.
 */
function adultMessageVisibility(sql: Sql, input: AdultConversationScope) {
  return sql`
    message.family_id = ${input.familyId}
    and message.visibility = 'family'
    and exists (
      select 1
      from public.family_members current_member
      where current_member.family_id = message.family_id
        and current_member.user_id = ${input.memberUserId}
    )
    and (
      (
        message.role = 'user'
        and message.member_user_id = ${input.memberUserId}
      )
      or (
        message.role = 'assistant'
        and message.member_user_id = ${input.memberUserId}
        and exists (
          select 1
          from public.conversation_messages user_message
          where user_message.family_id = message.family_id
            and user_message.session_id = message.session_id
            and user_message.role = 'user'
        )
        and not exists (
          select 1
          from public.conversation_messages user_message
          where user_message.family_id = message.family_id
            and user_message.session_id = message.session_id
            and user_message.role = 'user'
            and user_message.member_user_id
              is distinct from ${input.memberUserId}
        )
      )
      or exists (
        select 1
        from public.conversation_deliveries delivery
        where delivery.family_id = message.family_id
          and delivery.message_id = message.id
          and delivery.recipient_member_user_id = ${input.memberUserId}
          and delivery.status = 'sent'
      )
    )
  `;
}

export async function exportConversationMessagesForAdult(
  sql: Sql,
  input: AdultConversationScope
): Promise<ExportedConversationMessage[]> {
  const visibleToAdult = adultMessageVisibility(sql, input);
  const rows = await sql<{ value: ExportedConversationMessage[] }[]>`
    select coalesce(
      jsonb_agg(to_jsonb(message) order by message.created_at),
      '[]'::jsonb
    ) as value
    from public.conversation_messages message
    where ${visibleToAdult}
  `;
  return rows[0]?.value ?? [];
}

export async function loadAdultSessionReviewMessages(
  sql: Sql,
  input: AdultConversationScope & {
    sessionId: string;
    afterSequence: number;
    limit: number;
  }
): Promise<AdultSessionReviewMessage[]> {
  const visibleToAdult = adultMessageVisibility(sql, input);
  return await sql<AdultSessionReviewMessage[]>`
    select message.sequence, message.role, message.content
    from public.conversation_messages message
    where ${visibleToAdult}
      and message.session_id = ${input.sessionId}
      and message.sequence > ${input.afterSequence}
    order by message.sequence asc
    limit ${input.limit}
  `;
}
