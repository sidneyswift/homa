import { embedText } from "./learning/embeddings";
import { mapDb } from "./map/db";

/**
 * Writes one conversation message row for the persist-conversation hook
 * (agent/hooks/persist-conversation.ts). Server-only connection by
 * design: conversation_messages has NO authenticated write policy, so a
 * browser can never forge history; only this hook-driven path writes,
 * and members read their own rows through RLS (the recall tool's path).
 */

const CONTENT_MAX_CHARS = 8000;

export interface PersistMessageInput {
  attributes: unknown;
  sessionId: string;
  channelKind: string | undefined;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  turnId: string | undefined;
}

/** The telnyx channel is the only chat-sdk channel mounted, so a
 * chat-sdk kind means SMS; everything else is the web eve channel. */
function channelLabel(kind: string | undefined): "web" | "sms" {
  if (kind && (kind.includes("telnyx") || kind.includes("chat-sdk"))) return "sms";
  return "web";
}

export async function persistConversationMessage(
  input: PersistMessageInput,
): Promise<void> {
  const attrs = (input.attributes ?? {}) as { familyId?: string };
  const familyId = attrs.familyId;
  if (!familyId) return;

  const content = input.content.trim().slice(0, CONTENT_MAX_CHARS);
  if (content.length === 0) return;

  // Best-effort semantic index (about 200-400ms per message inside the
  // hook, after the user already has their streamed text). Null means
  // this row is findable by FTS only, never a failed write.
  const embedding = await embedText(content);

  const sql = mapDb();
  await sql`
    insert into public.conversation_messages
      (family_id, session_id, sequence, channel, role, content, turn_id, embedding)
    values (
      ${familyId},
      ${input.sessionId},
      ${input.sequence},
      ${channelLabel(input.channelKind)},
      ${input.role},
      ${content},
      ${input.turnId ?? null},
      ${embedding}
    )
    on conflict (session_id, sequence) do nothing
  `;
}
