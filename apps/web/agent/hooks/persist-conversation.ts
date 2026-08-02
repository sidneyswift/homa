import { defineHook } from "eve/hooks";

import { canonicalInboundAuthAttributes } from "../../lib/conversation-continuity/canonical-inbound";
import {
  delegatedSessionLineage,
  isParentedEveSession,
} from "../../lib/conversation-continuity/session-lineage";
import { persistConversationMessage } from "../../lib/conversation-log";
import { emitMapEvent } from "../../lib/map/events";
import { protectOutboundChildFraming } from "../../lib/outbound-child-framing";
import { preparedResearchBriefOwnsCanonicalPersistence } from "../../lib/tasks/research-brief-delivery";
import { currentOutboundChildFramingApproval } from "../outbound-child-framing-state";

/**
 * Internal producer chatter is durable in Eve and its purpose-built row, but
 * is not a parent conversation and must not enter recall.
 */
export function shouldSkipConversationPersistence(
  attributes: unknown,
): boolean {
  const values = attributes as
    | { channel?: unknown; voiceBridge?: unknown }
    | undefined;
  return (
    values?.channel === "subject_lesson" ||
    values?.channel === "progress_next_move" ||
    values?.voiceBridge === "true"
  );
}

function outboundChannel(attributes: unknown) {
  const channel = (attributes as { channel?: unknown } | undefined)?.channel;
  if (channel === "web" || channel === "mobile") return channel;
  if (channel === "sms" || channel === "email" || channel === "dispatch") {
    return channel;
  }
  return null;
}

/**
 * The durable chat record (agentic ladder item 5, an M1-02 slice): every
 * parent-facing user and assistant message lands
 * in public.conversation_messages the moment its stream event is durably
 * recorded. eve's Workflow storage keeps the live session; Postgres keeps
 * the permanent, searchable record the recall tool greps
 * (01-architecture.md state model; 15-agentic-architecture.md §5).
 *
 * familyId comes from the session's auth attributes, stamped by the
 * channel (the caller's own RLS membership on web, the parent-written
 * phone mapping on SMS), never from model output. Sessions with no
 * familyId (unlinked SMS, unauthenticated dev probes) are skipped whole.
 *
 * Failure posture: a parent message is load-bearing canonical input, so its
 * persistence failure aborts the turn before tools can run. Assistant writes
 * remain best-effort in this generic hook because channel delivery handlers
 * persist terminal output before sending it. Idempotency rides the
 * (session_id, turn_id, role, sequence) key.
 */
export default defineHook({
  events: {
    async "message.received"(event, ctx) {
      const attributes = ctx.session.auth.current?.attributes;
      if (shouldSkipConversationPersistence(attributes)) return;

      try {
        const familyId = (
          ctx.session.auth.current?.attributes as
            | { familyId?: string }
            | undefined
        )?.familyId;
        if (ctx.session.parent && familyId) {
          const lineage = delegatedSessionLineage({
            childSessionId: ctx.session.id,
            parent: ctx.session.parent,
          });
          await emitMapEvent("conversation.session_delegated", {
            family_id: familyId,
            child_session_hash: lineage.childSessionHash,
            parent_session_hash: lineage.parentSessionHash,
            root_session_hash: lineage.rootSessionHash,
          });
          return;
        }
        if (ctx.session.parent) return;

        const persisted = await persistConversationMessage({
          attributes,
          sessionId: ctx.session.id,
          channelKind: ctx.channel.kind,
          sequence: event.data.sequence,
          role: "user",
          content: event.data.message,
          turnId: event.data.turnId,
        });
        if (persisted && attributes) {
          Object.assign(
            attributes,
            canonicalInboundAuthAttributes({
              text: event.data.message,
              messageId: persisted.id,
            }),
          );
        }
      } catch (error) {
        console.error(
          "persist-conversation (user) failed:",
          error instanceof Error ? error.message : "unknown",
        );
        throw error;
      }
    },
    async "message.completed"(event, ctx) {
      const attributes = ctx.session.auth.current?.attributes;
      if (shouldSkipConversationPersistence(attributes)) return;
      if (isParentedEveSession(ctx.session.parent)) {
        return;
      }

      try {
        if (!event.data.message) return;
        // V2 dispatch validates and substitutes the staged draft before any
        // canonical write. The generic hook must never race that exact content.
        if (
          preparedResearchBriefOwnsCanonicalPersistence(
            ctx.session.auth.current?.attributes,
          )
        ) {
          return;
        }
        const channel = outboundChannel(attributes);
        const content = channel
          ? protectOutboundChildFraming({
              text: event.data.message.trim(),
              approvedText: currentOutboundChildFramingApproval(),
              channel,
            }).text
          : event.data.message;
        await persistConversationMessage({
          attributes,
          sessionId: ctx.session.id,
          channelKind: ctx.channel.kind,
          sequence: event.data.sequence,
          role: "assistant",
          content,
          turnId: event.data.turnId,
          finishReason: event.data.finishReason,
        });
      } catch (error) {
        console.error(
          "persist-conversation (assistant) failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
  },
});
