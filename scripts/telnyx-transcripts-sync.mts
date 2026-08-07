/**
 * Persist Telnyx voice-call transcripts into public.call_transcripts, for
 * BOTH lines (general companion + curriculum). Idempotent upsert keyed by
 * Telnyx conversation_id, so this both backfills history and, run on a
 * schedule, keeps the "save every call ALWAYS" guarantee even when a
 * real-time webhook misses (founder decision 2026-07-09, build-log).
 *
 * Usage:
 *   pnpm exec tsx scripts/telnyx-transcripts-sync.mts --confirm-prod             # sync recent (default 500)
 *   pnpm exec tsx scripts/telnyx-transcripts-sync.mts --limit 50 --confirm-prod
 *   pnpm exec tsx scripts/telnyx-transcripts-sync.mts <id> <id> --confirm-prod   # specific conversations
 *
 * Ownership is re-derived server-side: family from the caller's phone via
 * family_phones, child only if a metadata child_id actually belongs to
 * that family. Nothing is trusted blindly from Telnyx (BUILD.md law #1).
 *
 * Env (apps/web/.env.local, loaded by telnyx-shared): TELNYX_API_KEY,
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD.
 */

import postgres from "postgres";

import { embedText } from "../apps/web/lib/learning/embeddings";
import { assertConfirmedProdWrite } from "./prod-write-guard.mts";
import { listOf, normalizeTelnyxUsPhone, tx } from "./telnyx-shared.mts";

interface ConversationMeta {
  id: string;
  created_at: string;
  last_message_at?: string;
  metadata?: Record<string, string>;
}

interface ToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface Message {
  role: "user" | "assistant" | "tool";
  text: string | null;
  created_at: string;
  sent_at: string | null;
  tool_calls?: ToolCall[];
}

interface MessagesPage {
  data?: Message[];
  meta?: { total_pages?: number };
}

const CURRICULUM_ASSISTANT_ID = process.env.TELNYX_CURRICULUM_ASSISTANT_ID;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Server-only Postgres client, same pooled connection shape as mapDb. */
function db(): ReturnType<typeof postgres> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!supabaseUrl || !password) {
    console.error("sync: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD must be set");
    process.exit(2);
  }
  assertConfirmedProdWrite({
    scriptName: "telnyx-transcripts-sync",
    supabaseUrl,
  });
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  return postgres({
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    username: `postgres.${ref}`,
    password,
    ssl: "require",
    prepare: false,
    max: 2,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

function lineOf(metadata: Record<string, string> | undefined): "general" | "curriculum" {
  const id = metadata?.assistant_id;
  return CURRICULUM_ASSISTANT_ID && id === CURRICULUM_ASSISTANT_ID ? "curriculum" : "general";
}

async function fetchAllMessages(id: string): Promise<Message[]> {
  const all: Message[] = [];
  let page = 1;
  for (;;) {
    const payload = await tx<MessagesPage>(
      "GET",
      `/ai/conversations/${id}/messages?page[number]=${page}&page[size]=100`,
    );
    const data = payload.data ?? [];
    all.push(...data);
    const totalPages = payload.meta?.total_pages ?? 1;
    if (page >= totalPages || data.length === 0) break;
    page += 1;
  }
  return all.sort((a, b) => {
    const at = new Date(a.sent_at ?? a.created_at).getTime();
    const bt = new Date(b.sent_at ?? b.created_at).getTime();
    return at - bt;
  });
}

interface Owner {
  familyId: string | null;
  childId: string | null;
  caller: string | null;
  agent: string | null;
}

/** Family from the caller's phone; child only if it belongs to that family. */
async function resolveOwner(
  sql: ReturnType<typeof postgres>,
  metadata: Record<string, string> | undefined,
): Promise<Owner> {
  const endUser = normalizeTelnyxUsPhone(metadata?.telnyx_end_user_target);
  const agent = normalizeTelnyxUsPhone(metadata?.telnyx_agent_target);
  const candidates = [endUser, agent].filter((phone): phone is string => phone !== null);

  let familyId: string | null = null;
  if (candidates.length > 0) {
    const rows = await sql<{ family_id: string }[]>`
      select family_id from public.family_phones
      where phone_e164 in ${sql(candidates)}
      limit 1
    `;
    familyId = rows[0]?.family_id ?? null;
  }

  let childId: string | null = null;
  const metaChild = metadata?.child_id;
  if (familyId && metaChild && UUID_RE.test(metaChild)) {
    const rows = await sql<{ id: string }[]>`
      select id from public.children where id = ${metaChild} and family_id = ${familyId}
    `;
    if (rows[0]) childId = metaChild;
  }

  return {
    familyId,
    childId,
    caller: endUser ?? metadata?.telnyx_end_user_target ?? null,
    agent: agent ?? metadata?.telnyx_agent_target ?? null,
  };
}

/** Mirror of apps/web/lib/voice/transcript-sync.ts's flattener: one line
 * per spoken message, tool noise excluded, feeding the FTS column. */
function flattenTranscriptText(messages: Message[]): string {
  return messages
    .filter((message) => message.role !== "tool")
    .map((message) => (message.text ?? "").trim())
    .filter((text) => text.length > 0)
    .join(" ");
}

async function upsert(
  sql: ReturnType<typeof postgres>,
  conversation: ConversationMeta,
  messages: Message[],
  owner: Owner,
): Promise<void> {
  const endedAt =
    messages[messages.length - 1]?.sent_at ??
    conversation.last_message_at ??
    conversation.created_at;
  const transcriptText = flattenTranscriptText(messages);
  // Best-effort semantic index, same posture as the app-side sync.
  const embedding = await embedText(transcriptText);
  await sql`
    insert into public.call_transcripts
      (conversation_id, line, assistant_id, channel, family_id, child_id,
       member_user_id, caller_e164, agent_e164, messages, message_count,
       transcript_text, embedding, started_at, ended_at)
    values (
      ${conversation.id},
      ${lineOf(conversation.metadata)},
      ${conversation.metadata?.assistant_id ?? null},
      ${conversation.metadata?.telnyx_conversation_channel ?? null},
      ${owner.familyId},
      ${owner.childId},
      null,
      ${owner.caller},
      ${owner.agent},
      ${sql.json(messages as unknown as postgres.JSONValue)},
      ${messages.length},
      ${transcriptText},
      ${embedding},
      ${conversation.created_at},
      ${endedAt}
    )
    on conflict (conversation_id) do update set
      line = excluded.line,
      assistant_id = excluded.assistant_id,
      channel = excluded.channel,
      family_id = excluded.family_id,
      child_id = excluded.child_id,
      member_user_id = null,
      caller_e164 = excluded.caller_e164,
      agent_e164 = excluded.agent_e164,
      messages = excluded.messages,
      message_count = excluded.message_count,
      transcript_text = excluded.transcript_text,
      embedding = excluded.embedding,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      updated_at = now()
  `;
}

function parseArgs(argv: string[]): { ids: string[]; limit: number } {
  const ids: string[] = [];
  let limit = 500;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") {
      limit = Number(argv[index + 1]) || limit;
      index += 1;
    } else if (arg === "--confirm-prod") {
      continue;
    } else {
      ids.push(arg);
    }
  }
  return { ids, limit };
}

async function getConversation(id: string): Promise<ConversationMeta> {
  const payload = await tx<{ data?: ConversationMeta } & ConversationMeta>(
    "GET",
    `/ai/conversations/${id}`,
  );
  return payload.data ?? payload;
}

async function main(): Promise<void> {
  const { ids, limit } = parseArgs(process.argv.slice(2));
  const sql = db();

  const conversations =
    ids.length > 0
      ? await Promise.all(ids.map(getConversation))
      : listOf<ConversationMeta>(
          await tx("GET", `/ai/conversations?order=created_at.desc&limit=${limit}`),
        );

  console.log(`Syncing ${conversations.length} conversation(s) into call_transcripts...\n`);

  let stored = 0;
  let matched = 0;
  let unknown = 0;
  try {
    for (const conversation of conversations) {
      const messages = await fetchAllMessages(conversation.id);
      const owner = await resolveOwner(sql, conversation.metadata);
      await upsert(sql, conversation, messages, owner);
      stored += 1;
      if (owner.familyId) matched += 1;
      else unknown += 1;
      console.log(
        `  ${conversation.id}  ·  ${lineOf(conversation.metadata)}  ·  ` +
          `${messages.length} msgs  ·  ${owner.familyId ? `family ${owner.familyId}` : "unlinked caller"}`,
      );
    }
  } finally {
    await sql.end();
  }

  console.log(
    `\nDone. ${stored} stored (${matched} linked to a family, ${unknown} unlinked).`,
  );
}

await main();
