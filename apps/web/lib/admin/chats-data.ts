import { adminDb } from "./db";

/**
 * The founder chat reader (deep view direction 1's Chats tab and the
 * night-manager plan's /admin/chats, one implementation behind both
 * doors). Raw conversation_messages per ruling D-nm-2: the founder
 * reads every channel's thread, internal dispatch prompts included and
 * labeled. Queries follow the db.ts laws: sequential awaits, ::text
 * casts, json aggregates as text.
 */

export interface ChatFamilyRow {
  id: string;
  name: string;
  parentName: string | null;
  lastMessageAt: string | null;
  messages7d: number;
  messagesTotal: number;
}

export async function listChatFamilies(): Promise<ChatFamilyRow[]> {
  const sql = adminDb();
  const rows = await sql<
    {
      id: string;
      name: string;
      parent_display_name: string | null;
      last_message_at: string | null;
      messages_7d: number;
      messages_total: number;
    }[]
  >`
    select f.id, f.name, f.parent_display_name,
      (select max(m.created_at) from public.conversation_messages m
       where m.family_id = f.id)::text as last_message_at,
      (select count(*) from public.conversation_messages m
       where m.family_id = f.id
         and m.created_at >= now() - interval '7 days')::int as messages_7d,
      (select count(*) from public.conversation_messages m
       where m.family_id = f.id)::int as messages_total
    from public.families f
    where coalesce(f.status, 'open') <> 'deleted'
      and exists (select 1 from public.family_members fm where fm.family_id = f.id)
    order by last_message_at desc nulls last, f.created_at desc
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    parentName: row.parent_display_name,
    lastMessageAt: row.last_message_at,
    messages7d: row.messages_7d,
    messagesTotal: row.messages_total,
  }));
}

export interface ThreadMessage {
  id: string;
  sessionId: string;
  channel: string;
  role: "user" | "assistant";
  content: string;
  visibility: "family" | "internal";
  taskRunId: string | null;
  memberName: string | null;
  createdAt: string;
}

/** The newest `limit` messages, oldest first for reading. `before`
 * pages further back (pass the oldest visible createdAt); `channel`
 * narrows to one transport; `familyVisible` hides internal dispatch
 * prompts (her-screen mirrors what the parent sees). */
export async function getFamilyThread(
  familyId: string,
  options: {
    limit?: number;
    before?: string | null;
    channel?: string | null;
    familyVisible?: boolean;
  } = {},
): Promise<ThreadMessage[]> {
  const sql = adminDb();
  const limit = Math.min(options.limit ?? 200, 500);
  const before = options.before ?? null;
  const channel = options.channel ?? null;
  const rows = await sql<
    {
      id: string;
      session_id: string;
      channel: string;
      role: "user" | "assistant";
      content: string;
      visibility: "family" | "internal";
      task_run_id: string | null;
      member_name: string | null;
      created_at: string;
    }[]
  >`
    select m.id, m.session_id, m.channel, m.role, m.content,
           m.visibility, m.task_run_id,
           coalesce(fm.display_name, u.email) as member_name,
           m.created_at::text as created_at
    from public.conversation_messages m
    left join public.family_members fm
      on fm.user_id = m.member_user_id and fm.family_id = m.family_id
    left join auth.users u on u.id = m.member_user_id
    where m.family_id = ${familyId}
      and (${before === null} or m.created_at < ${before})
      and (${channel === null} or m.channel = ${channel ?? ""})
      and (${!options.familyVisible} or m.visibility = 'family')
    order by m.created_at desc
    limit ${limit}
  `;
  return rows.reverse().map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    channel: row.channel,
    role: row.role,
    content: row.content,
    visibility: row.visibility,
    taskRunId: row.task_run_id,
    memberName: row.member_name,
    createdAt: row.created_at,
  }));
}
