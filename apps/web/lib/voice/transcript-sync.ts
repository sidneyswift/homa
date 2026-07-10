import { normalizeUsPhoneE164 } from "@homa/core";

import { extractCallMemories } from "../learning/call-memory";
import { embedText } from "../learning/embeddings";
import { mapDb, type DbJson } from "../map/db";
import { emitMapEvent } from "../map/events";
import { telnyxConfigured, telnyxGet, telnyxListOf } from "./telnyx-api";

/**
 * Pulls Telnyx voice-call transcripts into public.call_transcripts, the
 * app-side twin of scripts/telnyx-transcripts-sync.mts (which remains the
 * ops backfill path). Runs inside the hourly cron so "save every call
 * ALWAYS" (founder ruling 2026-07-09) holds without a human running a
 * script. Idempotent by conversation_id; a re-sync refreshes messages.
 *
 * After a linked call lands, the post-call memory turn runs on it
 * (agentic ladder item 3): the model reads the verbatim transcript and
 * saves durable facts through the same scanned, budgeted path the chat
 * remember tool uses. Extraction is capped per sync pass to bound cost.
 *
 * Ownership is re-derived server-side (family from the caller's phone via
 * family_phones; child only if a metadata child_id belongs to that
 * family). Nothing is trusted blindly from Telnyx (BUILD.md law #1).
 */

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

interface TranscriptMessage {
  role: "user" | "assistant" | "tool";
  text: string | null;
  created_at: string;
  sent_at: string | null;
  tool_calls?: ToolCall[];
}

interface MessagesPage {
  data?: TranscriptMessage[];
  meta?: { total_pages?: number };
}

export interface TranscriptSyncResult {
  scanned: number;
  stored: number;
  linked: number;
  extracted: number;
  skipped: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bounds model spend per cron pass; a backlog drains across passes. */
const MAX_EXTRACTIONS_PER_SYNC = 3;

function lineOf(metadata: Record<string, string> | undefined): "general" | "curriculum" {
  const id = metadata?.assistant_id;
  const curriculumId = process.env.TELNYX_CURRICULUM_ASSISTANT_ID;
  return curriculumId && id === curriculumId ? "curriculum" : "general";
}

function isCall(conversation: ConversationMeta): boolean {
  const channel = conversation.metadata?.telnyx_conversation_channel ?? "";
  return channel.includes("call") || channel.includes("phone");
}

async function fetchAllMessages(conversationId: string): Promise<TranscriptMessage[]> {
  const all: TranscriptMessage[] = [];
  let page = 1;
  for (;;) {
    const payload = await telnyxGet<MessagesPage>(
      `/ai/conversations/${conversationId}/messages?page[number]=${page}&page[size]=100`,
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

/** One line per spoken message; tool noise stays out of the searchable text. */
export function flattenTranscriptText(messages: TranscriptMessage[]): string {
  return messages
    .filter((message) => message.role !== "tool")
    .map((message) => (message.text ?? "").trim())
    .filter((text) => text.length > 0)
    .join(" ");
}

interface Owner {
  familyId: string | null;
  childId: string | null;
  caller: string | null;
  agent: string | null;
}

async function resolveOwner(
  metadata: Record<string, string> | undefined,
): Promise<Owner> {
  const sql = mapDb();
  const endUser = normalizeUsPhoneE164(metadata?.telnyx_end_user_target ?? "");
  const agent = normalizeUsPhoneE164(metadata?.telnyx_agent_target ?? "");
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

/** Upserts one conversation; returns whether the row was newly inserted. */
async function upsertTranscript(
  conversation: ConversationMeta,
  messages: TranscriptMessage[],
  owner: Owner,
): Promise<{ id: string; inserted: boolean }> {
  const sql = mapDb();
  const endedAt =
    messages[messages.length - 1]?.sent_at ??
    conversation.last_message_at ??
    conversation.created_at;
  const transcriptText = flattenTranscriptText(messages);
  // Best-effort semantic index; null just means FTS-only for this call.
  const embedding = await embedText(transcriptText, { familyId: owner.familyId });
  const rows = await sql<{ id: string; inserted: boolean }[]>`
    insert into public.call_transcripts
      (conversation_id, line, assistant_id, channel, family_id, child_id,
       caller_e164, agent_e164, messages, message_count, transcript_text,
       embedding, started_at, ended_at)
    values (
      ${conversation.id},
      ${lineOf(conversation.metadata)},
      ${conversation.metadata?.assistant_id ?? null},
      ${conversation.metadata?.telnyx_conversation_channel ?? null},
      ${owner.familyId},
      ${owner.childId},
      ${owner.caller},
      ${owner.agent},
      ${sql.json(messages as unknown as DbJson)},
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
      caller_e164 = excluded.caller_e164,
      agent_e164 = excluded.agent_e164,
      messages = excluded.messages,
      message_count = excluded.message_count,
      transcript_text = excluded.transcript_text,
      embedding = excluded.embedding,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      updated_at = now()
    returning id, (xmax = 0) as inserted
  `;
  return rows[0];
}

/** Conversations already stored with this exact message count skip the
 * per-message re-fetch, so the steady-state hourly pass stays cheap. */
async function storedStates(
  conversationIds: string[],
): Promise<Map<string, { messageCount: number; extracted: boolean }>> {
  if (conversationIds.length === 0) return new Map();
  const sql = mapDb();
  const rows = await sql<
    { conversation_id: string; message_count: number; extracted: boolean }[]
  >`
    select conversation_id, message_count, (memory_extracted_at is not null) as extracted
    from public.call_transcripts
    where conversation_id in ${sql(conversationIds)}
  `;
  return new Map(
    rows.map((row) => [
      row.conversation_id,
      { messageCount: row.message_count, extracted: row.extracted },
    ]),
  );
}

export async function syncCallTranscripts(limit = 40): Promise<TranscriptSyncResult> {
  if (!telnyxConfigured()) {
    return { scanned: 0, stored: 0, linked: 0, extracted: 0, skipped: true };
  }

  // Over-fetch then keep voice calls only (SMS threads live in eve, not here).
  const payload = await telnyxGet(
    `/ai/conversations?order=created_at.desc&limit=${limit * 2}`,
  );
  const conversations = telnyxListOf<ConversationMeta>(payload)
    .filter(isCall)
    .slice(0, limit);

  const known = await storedStates(conversations.map((c) => c.id));

  let stored = 0;
  let linked = 0;
  let extracted = 0;

  for (const conversation of conversations) {
    try {
      const messages = await fetchAllMessages(conversation.id);
      const prior = known.get(conversation.id);
      const unchanged = prior !== undefined && prior.messageCount === messages.length;

      let rowId: string | null = null;
      let familyLinked = false;
      if (!unchanged) {
        const owner = await resolveOwner(conversation.metadata);
        const row = await upsertTranscript(conversation, messages, owner);
        rowId = row.id;
        familyLinked = owner.familyId !== null;
        stored += 1;
        if (familyLinked) linked += 1;
        if (row.inserted) {
          await emitMapEvent("voice.transcript_synced", {
            line: lineOf(conversation.metadata),
            message_count: messages.length,
            linked_family: familyLinked,
          });
        }
      }

      // The post-call memory turn: linked, settled (unchanged since last
      // pass, meaning the call is over), never extracted, and under the
      // per-pass cap. A just-stored row extracts on the NEXT pass, which
      // also guarantees the call has actually ended.
      if (
        unchanged &&
        prior !== undefined &&
        !prior.extracted &&
        extracted < MAX_EXTRACTIONS_PER_SYNC
      ) {
        const didExtract = await extractCallMemories(conversation.id);
        if (didExtract) extracted += 1;
      }
      void rowId;
    } catch (error) {
      console.error(
        `transcript sync: ${conversation.id} failed:`,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return { scanned: conversations.length, stored, linked, extracted, skipped: false };
}
