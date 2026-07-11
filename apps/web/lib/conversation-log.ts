import {
  resolveInboundContinuity,
  resolvedContinuityAttributes,
} from "./conversation-continuity/ledger";
import { persistCanonicalMessage } from "./conversation-continuity/ledger";
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
  finishReason?: string;
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
  const attrs = (input.attributes ?? {}) as {
    familyId?: string;
    memberUserId?: string;
    episodeId?: string;
    providerMessageId?: string;
    phoneNumber?: string;
    email?: string;
  };
  const familyId = attrs.familyId;
  if (!familyId) return;

  const content = input.content.trim().slice(0, CONTENT_MAX_CHARS);
  if (content.length === 0) return;
  const channel = channelLabel(input.attributes, input.channelKind);
  let continuityAttributes: Record<string, string> = {};
  if (input.role === "user" && !attrs.episodeId) {
    try {
      const continuity = await resolveInboundContinuity({
        familyId,
        memberUserId: attrs.memberUserId ?? null,
        channel: channel === "dispatch" ? "web" : channel,
        transportThreadKey:
          attrs.phoneNumber ??
          attrs.email ??
          `${channel}:${input.sessionId}`,
        runtimeSessionId: input.sessionId,
        providerMessageId: attrs.providerMessageId ?? null,
        providerReplyTo: null,
        destinationKey: attrs.phoneNumber ?? attrs.email ?? null,
        text: content,
      });
      continuityAttributes = resolvedContinuityAttributes(continuity, {
        memberUserId: attrs.memberUserId ?? null,
        providerMessageId: attrs.providerMessageId ?? null,
      });
    } catch (error) {
      console.error(
        "conversation continuity resolution failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  // Best-effort semantic index (about 200-400ms per message inside the
  // hook, after the user already has their streamed text). Null means
  // this row is findable by FTS only, never a failed write.
  const embedding = await embedText(content, { familyId });

  const persisted = await persistCanonicalMessage({
    attributes: { ...attrs, ...continuityAttributes },
    sessionId: input.sessionId,
    channel,
    sequence: input.sequence,
    role: input.role,
    content,
    turnId: input.turnId,
    providerMessageId: attrs.providerMessageId ?? null,
    terminal:
      input.role === "assistant"
        ? input.finishReason === "stop"
        : undefined,
  });
  if (persisted && embedding) {
    const sql = mapDb();
    await sql`
      update public.conversation_messages
      set embedding = ${embedding}
      where id = ${persisted.id} and embedding is null
    `;
  }
}
