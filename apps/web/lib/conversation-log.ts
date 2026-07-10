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

/** Sessions stamped by an adapter carry their surface in auth attributes
 * (sms, email, dispatch); the chat-sdk kind covers SMS's bridge; the
 * bare eve channel is web. */
function channelLabel(
  attributes: unknown,
  kind: string | undefined,
): "web" | "sms" | "email" | "dispatch" {
  const channel = ((attributes ?? {}) as { channel?: string }).channel;
  if (channel === "sms" || channel === "email" || channel === "dispatch") return channel;
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
  const embedding = await embedText(content, { familyId });

  const sql = mapDb();
  await sql`
    insert into public.conversation_messages
      (family_id, session_id, sequence, channel, role, content, turn_id, embedding)
    values (
      ${familyId},
      ${input.sessionId},
      ${input.sequence},
      ${channelLabel(input.attributes, input.channelKind)},
      ${input.role},
      ${content},
      ${input.turnId ?? null},
      ${embedding}
    )
    on conflict (session_id, (coalesce(turn_id, '')), role, sequence) do nothing
  `;
}
