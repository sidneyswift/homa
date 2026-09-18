import {
  persistCanonicalMessage,
  resolveInboundContinuity,
  resolvedContinuityAttributes,
  type InboundContinuityInput,
  type PersistCanonicalMessageInput,
} from "./conversation-continuity/ledger";
import { embedText } from "./learning/embeddings";
import { mapDb } from "./map/db";
import { isHiddenDirective } from "./onboarding/directives";
import { measureChatPreparation, type ChatPreparationTrace } from "./observability/chat-preparation";

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
  /** Server-only experiment: canonical save atomically queues semantic indexing. */
  deferSemanticIndex?: boolean;
}

export interface PersistConversationMessageDependencies {
  resolveInbound(
    input: InboundContinuityInput,
  ): ReturnType<typeof resolveInboundContinuity>;
  persistCanonical(
    input: PersistCanonicalMessageInput,
  ): ReturnType<typeof persistCanonicalMessage>;
  embed(text: string, attribution: {
    familyId: string;
    preparationTrace?: ChatPreparationTrace;
  }): Promise<string | null>;
  /** sourceContent guards a replayed/delayed embedding write: the row's
   *  content may have moved on (a later terminal replacement) by the time
   *  this resolves, and a vector for text the row no longer holds must
   *  never attach. replaceExisting is true only for a terminal assistant
   *  stop: a draft's embedding is stale the moment the terminal text
   *  replaces its content, so the terminal write must overwrite it
   *  instead of leaving the draft vector behind a canonical row it no
   *  longer matches. */
  saveEmbedding(
    messageId: string,
    embedding: string,
    sourceContent: string,
    replaceExisting: boolean,
  ): Promise<void>;
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

/** Re-scoped by family_id (every model/caller-supplied id is re-scoped
 * inside the authenticated family, the tenancy law). sourceContent rejects
 * a replayed or delayed embedding whose text no longer matches the row
 * (a later terminal write already replaced it). replaceExisting is true
 * only for a terminal assistant stop: a draft's embedding is stale the
 * moment the terminal text replaces its content, so the terminal write
 * must overwrite it instead of leaving the draft vector behind a
 * canonical row it no longer matches. Exported so continuity e2e
 * fixtures can seed a specific embedding directly. */
export async function updateConversationMessageEmbedding(input: {
  familyId: string;
  messageId: string;
  embedding: string;
  sourceContent: string;
  replaceExisting: boolean;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.conversation_messages
    set embedding = ${input.embedding}
    where id = ${input.messageId}
      and family_id = ${input.familyId}
      and content = ${input.sourceContent}
      and (${input.replaceExisting} or embedding is null)
  `;
}

export async function persistConversationMessage(
  input: PersistMessageInput,
  dependencies?: PersistConversationMessageDependencies,
): Promise<
  Awaited<ReturnType<typeof persistCanonicalMessage>>
> {
  const familyId = (input.attributes as { familyId?: string } | undefined)
    ?.familyId;
  const persist = () => persistConversationMessageWithDependencies(
    input,
    dependencies ?? {
      resolveInbound: resolveInboundContinuity,
      persistCanonical: persistCanonicalMessage,
      embed: embedText,
      async saveEmbedding(messageId, embedding, sourceContent, replaceExisting) {
        if (!familyId) return;
        await updateConversationMessageEmbedding({
          familyId,
          messageId,
          embedding,
          sourceContent,
          replaceExisting,
        });
      },
    },
  );
  return input.role === "user"
    ? measureChatPreparation("user_persistence", persist, input.sessionId, {
        role: input.role, turnId: input.turnId, sequence: input.sequence,
      })
    : persist();
}

async function persistConversationMessageWithDependencies(
  input: PersistMessageInput,
  dependencies: PersistConversationMessageDependencies,
): Promise<
  Awaited<ReturnType<typeof persistCanonicalMessage>>
> {
  const attrs = (input.attributes ?? {}) as {
    familyId?: string;
    memberUserId?: string;
    episodeId?: string;
    providerMessageId?: string;
    providerReplyTo?: string;
    phoneNumber?: string;
    email?: string;
    messageModality?: string;
  };
  const familyId = attrs.familyId;
  if (!familyId) return null;

  const content = input.content.trim().slice(0, CONTENT_MAX_CHARS);
  if (content.length === 0) return null;
  const channel = channelLabel(input.attributes, input.channelKind);
  let continuityAttributes: Record<string, string> = {};
  if (input.role === "user" && !attrs.episodeId) {
    try {
      const continuity = await dependencies.resolveInbound({
        familyId,
        memberUserId: attrs.memberUserId ?? null,
        channel: channel === "dispatch" ? "web" : channel,
        transportThreadKey:
          attrs.phoneNumber ??
          attrs.email ??
          `${channel}:${input.sessionId}`,
        runtimeSessionId: input.sessionId,
        providerMessageId: attrs.providerMessageId ?? null,
        providerReplyTo: attrs.providerReplyTo ?? null,
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

  const isTerminalAssistantStop =
    input.role === "assistant" && input.finishReason === "stop";

  const trace: ChatPreparationTrace | undefined = input.role === "user"
    ? { sessionId: input.sessionId, turnId: input.turnId, role: input.role, sequence: input.sequence }
    : undefined;

  const deferIndex = input.role === "user" &&
    (input.deferSemanticIndex ?? process.env.HOMA_DEFER_USER_INDEX === "true");

  // Best-effort semantic index, awaited before canonical persistence on
  // both user and assistant messages. Null means
  // this row is findable by FTS only, never a failed write.
  //
  // A hidden onboarding directive is skipped: it is the app talking, so
  // indexing it would put machine text in the same vector space recall
  // searches for the parent's own words, and it would spend an embedding
  // call on a string nobody will ever look for.
  const embedding = deferIndex || isHiddenDirective(content)
    ? null
    : trace
      ? await measureChatPreparation("embedding_total", () => dependencies.embed(content, {
          familyId, preparationTrace: trace,
        }), input.sessionId, trace)
      : await dependencies.embed(content, { familyId });

  const persistCanonical = () => dependencies.persistCanonical({
    attributes: { ...attrs, ...continuityAttributes },
    deferSemanticIndex: deferIndex && !isHiddenDirective(content) && content.length >= 3,
    sessionId: input.sessionId,
    channel,
    sequence: input.sequence,
    role: input.role,
    content,
    turnId: input.turnId,
    providerMessageId: attrs.providerMessageId ?? null,
    modality:
      input.role === "user" && attrs.messageModality === "voice"
        ? "voice"
        : "text",
    terminal:
      input.role === "assistant"
        ? isTerminalAssistantStop
        : undefined,
  });
  const persisted = trace
    ? await measureChatPreparation("canonical_persistence", persistCanonical, input.sessionId, trace)
    : await persistCanonical();
  if (persisted && embedding) {
    const saveEmbedding = () => dependencies.saveEmbedding(
      persisted.id,
      embedding,
      content,
      isTerminalAssistantStop,
    );
    if (trace) {
      await measureChatPreparation("embedding_update", saveEmbedding, input.sessionId, trace);
    } else {
      await saveEmbedding();
    }
  }
  return persisted;
}
