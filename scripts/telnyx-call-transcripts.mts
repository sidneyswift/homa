/**
 * Read-only ops query: print the verbatim transcript of Telnyx AI calls.
 * This pulls the actual message history from Telnyx (the system of record
 * for what was said), NOT the distilled transcript_facts Homa stores.
 *
 * Usage:
 *   pnpm exec tsx scripts/telnyx-call-transcripts.mts            # most recent 5 calls
 *   pnpm exec tsx scripts/telnyx-call-transcripts.mts <id> <id>  # specific conversations
 *   pnpm exec tsx scripts/telnyx-call-transcripts.mts --limit 10 # most recent 10 calls
 *
 * Transcript source: GET /ai/conversations/{id}/messages (paginated).
 * Reuses the shared REST helper so the API key comes from .env.local.
 */

import { tx, listOf } from "./telnyx-shared.mts";

interface ConversationMeta {
  id: string;
  created_at: string;
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
  meta?: { total_pages?: number; page_number?: number };
}

const TIME_ZONE = "America/New_York";
const CURRICULUM_ASSISTANT_ID = process.env.TELNYX_CURRICULUM_ASSISTANT_ID;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function channelOf(conversation: ConversationMeta): string {
  return conversation.metadata?.telnyx_conversation_channel ?? "unknown";
}

function isCall(conversation: ConversationMeta): boolean {
  const channel = channelOf(conversation);
  return channel.includes("call") || channel.includes("phone");
}

function assistantLabel(conversation: ConversationMeta): string {
  const id = conversation.metadata?.assistant_id;
  if (!id) return "(no assistant id)";
  if (CURRICULUM_ASSISTANT_ID && id === CURRICULUM_ASSISTANT_ID) return "curriculum call";
  return "general voice line";
}

/** Speaker label from the message role: assistant = Homa, user = caller. */
function speaker(role: Message["role"]): string {
  switch (role) {
    case "assistant":
      return "Homa  ";
    case "user":
      return "Caller";
    case "tool":
      return "Tool  ";
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}

function parseArgs(argv: string[]): { ids: string[]; limit: number } {
  const ids: string[] = [];
  let limit = 5;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") {
      limit = Number(argv[index + 1]) || limit;
      index += 1;
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

async function recentCalls(limit: number): Promise<ConversationMeta[]> {
  // Over-fetch, then keep only voice-call channels (drops any SMS threads).
  const payload = await tx("GET", `/ai/conversations?order=created_at.desc&limit=${limit * 3}`);
  return listOf<ConversationMeta>(payload).filter(isCall).slice(0, limit);
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
  // sent_at is the moment the end user experienced the message (Telnyx's
  // own guidance); fall back to created_at when a message was never sent.
  return all.sort((a, b) => {
    const at = new Date(a.sent_at ?? a.created_at).getTime();
    const bt = new Date(b.sent_at ?? b.created_at).getTime();
    return at - bt;
  });
}

function printToolCalls(toolCalls: ToolCall[]): void {
  for (const call of toolCalls) {
    const name = call.function?.name ?? call.type ?? "tool";
    let args = call.function?.arguments ?? "";
    try {
      args = JSON.stringify(JSON.parse(args));
    } catch {
      // leave the raw string as-is if it is not valid JSON
    }
    console.log(`  Homa   → calls ${name}(${args})`);
  }
}

function printTranscript(conversation: ConversationMeta, messages: Message[]): void {
  const from = conversation.metadata?.telnyx_end_user_target ?? "unknown caller";
  const to = conversation.metadata?.telnyx_agent_target ?? "unknown line";
  console.log("\n" + "=".repeat(72));
  console.log(
    `${fmtTime(conversation.created_at)}  ·  ${assistantLabel(conversation)}  ·  ` +
      `from ${from} → ${to}`,
  );
  console.log(`id ${conversation.id}  ·  ${messages.length} messages`);
  console.log("-".repeat(72));

  if (messages.length === 0) {
    console.log("(no messages recorded for this conversation)");
    return;
  }

  for (const message of messages) {
    const text = (message.text ?? "").trim();
    if (text.length > 0) {
      console.log(`  ${speaker(message.role)}: ${text}`);
    }
    if (message.tool_calls && message.tool_calls.length > 0) {
      printToolCalls(message.tool_calls);
    }
  }
}

async function main(): Promise<void> {
  const { ids, limit } = parseArgs(process.argv.slice(2));

  const conversations =
    ids.length > 0
      ? await Promise.all(ids.map(getConversation))
      : await recentCalls(limit);

  if (conversations.length === 0) {
    console.log("No matching conversations found.");
    return;
  }

  console.log(`Pulling transcripts for ${conversations.length} call(s)...`);
  for (const conversation of conversations) {
    const messages = await fetchAllMessages(conversation.id);
    printTranscript(conversation, messages);
  }
  console.log("");
}

await main();
