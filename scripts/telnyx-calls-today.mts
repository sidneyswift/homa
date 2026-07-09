/**
 * Read-only ops query: list today's Telnyx AI conversations (voice calls
 * first, other channels noted). Reuses the shared REST helper so the API
 * key is read from apps/web/.env.local, never passed on the command line.
 *
 * Usage: pnpm exec tsx scripts/telnyx-calls-today.mts
 *
 * "Today" means since local midnight (America/New_York). The Telnyx list
 * endpoint takes PostgREST-style filters, so created_at=gte.<UTC ISO>
 * bounds the query server-side; we sort newest-first.
 */

import { tx, listOf } from "./telnyx-shared.mts";

interface Conversation {
  id: string;
  name?: string;
  created_at: string;
  last_message_at: string;
  metadata?: Record<string, string>;
}

const TIME_ZONE = "America/New_York";
const CURRICULUM_ASSISTANT_ID = process.env.TELNYX_CURRICULUM_ASSISTANT_ID;

function startOfLocalToday(): Date {
  const now = new Date();
  // Local-midnight Date; toISOString() below converts it to the UTC instant.
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function channelOf(conversation: Conversation): string {
  return conversation.metadata?.telnyx_conversation_channel ?? "unknown";
}

function isCall(conversation: Conversation): boolean {
  const channel = channelOf(conversation);
  return channel.includes("call") || channel.includes("phone");
}

function assistantLabel(conversation: Conversation): string {
  const id = conversation.metadata?.assistant_id;
  if (!id) return "(no assistant id)";
  if (CURRICULUM_ASSISTANT_ID && id === CURRICULUM_ASSISTANT_ID) {
    return "curriculum call";
  }
  return `assistant ${id}`;
}

async function listConversations(query: string): Promise<Conversation[]> {
  const payload = await tx("GET", `/ai/conversations?${query}`);
  return listOf<Conversation>(payload);
}

function printCall(conversation: Conversation): void {
  const from = conversation.metadata?.telnyx_end_user_target ?? "unknown caller";
  const to = conversation.metadata?.telnyx_agent_target ?? "unknown line";
  console.log(
    [
      `  ${fmtTime(conversation.created_at)}`,
      `from ${from}`,
      `to ${to}`,
      `[${channelOf(conversation)}]`,
      assistantLabel(conversation),
    ].join("  ·  "),
  );
  console.log(`      last message ${fmtTime(conversation.last_message_at)}  ·  id ${conversation.id}`);
}

async function main(): Promise<void> {
  const since = startOfLocalToday();
  const query =
    `created_at=gte.${encodeURIComponent(since.toISOString())}` +
    `&order=created_at.desc&limit=200`;

  const today = await listConversations(query);
  const calls = today.filter(isCall);
  const other = today.filter((conversation) => !isCall(conversation));

  console.log(
    `\nTelnyx conversations since ${fmtTime(since.toISOString())} (local): ` +
      `${today.length} total, ${calls.length} call${calls.length === 1 ? "" : "s"}.\n`,
  );

  if (calls.length > 0) {
    console.log("Calls today:");
    for (const call of calls) printCall(call);
  } else {
    console.log("No voice calls today.");
    // Prove the query works and show what is there: last few overall.
    const recent = await listConversations("order=created_at.desc&limit=5");
    if (recent.length > 0) {
      console.log("\nMost recent conversations (any date/channel):");
      for (const conversation of recent) {
        console.log(
          `  ${fmtTime(conversation.created_at)}  ·  [${channelOf(conversation)}]  ·  ` +
            `${assistantLabel(conversation)}  ·  id ${conversation.id}`,
        );
      }
    }
  }

  if (other.length > 0) {
    console.log(`\nAlso today: ${other.length} non-call conversation(s) (e.g. SMS).`);
  }
  console.log("");
}

await main();
