import { getFamilyMaterialsDeep } from "./family-deep-data";
import { adminDb } from "./db";

/**
 * The founder chat reader (deep view direction 1's Chats tab and the
 * night-manager plan's /admin/chats, one implementation behind both
 * doors). Raw conversation_messages per ruling D-nm-2: the founder
 * reads every channel's thread, internal dispatch prompts included and
 * labeled. Queries follow the db.ts laws: sequential awaits, ::text
 * casts, json aggregates as text.
 *
 * Text alone cannot answer "did the material actually reach her": a
 * reply saying "it's ready" is Homa's copy, not proof a card rendered.
 * getFamilyThread attaches each turn's real public.materials rows (the
 * same ones the parent's MaterialCard drew from) by matching
 * generation.sessionId/turnId back to the assistant message's own
 * session_id/turn_id, so the thread shows what she actually got.
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

export interface ThreadMaterial {
  id: string;
  title: string;
  status: string;
  previewUrl: string;
  pdfUrl: string;
  skill: string | null;
  childName: string | null;
  reviewPass: boolean | null;
  reviewIssues: string[];
  createdAt: string;
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
  /** Materials generated in this exact turn, oldest first; empty when
   * this turn made none. A message that talks about a worksheet with
   * no matching row here means no material actually saved. */
  materials: ThreadMaterial[];
}

/** Keys a family's materials by the turn that made them, so a chat
 * message can look up what it actually produced instead of trusting
 * its own wording. */
function materialsByTurn(
  materials: Awaited<ReturnType<typeof getFamilyMaterialsDeep>>,
): Map<string, ThreadMaterial[]> {
  const byTurn = new Map<string, ThreadMaterial[]>();
  for (const material of materials) {
    const sessionId = material.generation?.sessionId;
    const turnId = material.generation?.turnId;
    if (!sessionId || !turnId) continue;
    const key = `${sessionId}:${turnId}`;
    const entry: ThreadMaterial = {
      id: material.id,
      title: material.title,
      status: material.status,
      previewUrl: material.previewUrl,
      pdfUrl: material.pdfUrl,
      skill: material.skill,
      childName: material.childName,
      reviewPass: material.generation?.review?.pass ?? null,
      reviewIssues: material.generation?.review?.issues ?? [],
      createdAt: material.createdAt,
    };
    const existing = byTurn.get(key);
    if (existing) existing.push(entry);
    else byTurn.set(key, [entry]);
  }
  for (const entries of byTurn.values()) {
    entries.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }
  return byTurn;
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
      turn_id: string | null;
      channel: string;
      role: "user" | "assistant";
      content: string;
      visibility: "family" | "internal";
      task_run_id: string | null;
      member_name: string | null;
      created_at: string;
    }[]
  >`
    select m.id, m.session_id, m.turn_id, m.channel, m.role, m.content,
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
  // Sequential per the db.ts laws: the message page above must finish
  // before this second read starts.
  const materials = rows.length > 0 ? await getFamilyMaterialsDeep(familyId) : [];
  const byTurn = materialsByTurn(materials);
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
    materials:
      row.role === "assistant" && row.turn_id
        ? byTurn.get(`${row.session_id}:${row.turn_id}`) ?? []
        : [],
  }));
}
