import { defineHook } from "eve/hooks";

import { canonicalInboundAuthAttributes } from "../../lib/conversation-continuity/canonical-inbound";
import {
  delegatedSessionLineage,
  isParentedEveSession,
} from "../../lib/conversation-continuity/session-lineage";
import { persistConversationMessage } from "../../lib/conversation-log";
import { admitConversationRequest, admitNativeConversationContinuation, conversationRequestEnvelope } from "../../lib/conversation-request-admission";
import { requireConversationJobAccess } from "../../lib/conversation-jobs";
import { requireConversationRequestAccess } from "../../lib/conversation-request-access";
import { prepareConversationRequestContext } from "../../lib/conversation-request-context";
import { conversationRecordingEnabled } from "../../lib/conversation-recording";
import { parseConversationQuestionResult } from "../../lib/conversation-question-card";
import { recordConversationQuestion, finishConversationQuestionTurn, observeConversationRequestOutcome } from "../../lib/conversation-requests";
import { TOOL_DEADLINE, withToolDeadline } from "../../lib/agent-tool-deadline";
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
  if (channel === "conversation-request") return "web";
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
    async "turn.started"(event, ctx) {
      await withToolDeadline(TOOL_DEADLINE.quick, () => requireConversationJobAccess(ctx.session, "prepare"), true);
      if (!ctx.session.parent) await withToolDeadline(TOOL_DEADLINE.quick, () => admitNativeConversationContinuation({
        auth: ctx.session.auth.current, sessionId: ctx.session.id, turnId: event.data.turnId, sequence: event.data.sequence,
      }), true);
      // Global hooks run before dynamic family instructions for this event.
      // message.received happens later, so validate the lease before hydration.
      await withToolDeadline(TOOL_DEADLINE.quick, () => prepareConversationRequestContext(ctx.session), true);
    },
    async "message.received"(event, ctx) {
      const attributes = ctx.session.auth.current?.attributes;
      // Root dispatch must validate before any persistence skip. Children keep
      // the existing lineage-only path; they are not a second accepted input.
      if (!ctx.session.parent) conversationRequestEnvelope(ctx.session.auth.current);
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

        const admission = await admitConversationRequest({
          auth: ctx.session.auth.current, sessionId: ctx.session.id,
          turnId: event.data.turnId, sequence: event.data.sequence, text: event.data.message,
        });
        const persisted = admission ? { id: admission.messageId } : await persistConversationMessage({
          attributes,
          sessionId: ctx.session.id,
          channelKind: ctx.channel.kind,
          sequence: event.data.sequence,
          role: "user",
          content: event.data.message,
          turnId: event.data.turnId,
        });
        if (admission && persisted?.id !== admission.messageId) {
          throw new Error("Accepted conversation identity changed during persistence");
        }
        if (persisted && attributes) {
          Object.assign(
            attributes,
            canonicalInboundAuthAttributes({
              text: admission?.text ?? event.data.message,
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

      // The permanent source consumer is the sole writer for recorded requests.
      if (conversationRecordingEnabled() && conversationRequestEnvelope(ctx.session.auth.current)) return;
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
        const persisted = await persistConversationMessage({
          attributes,
          sessionId: ctx.session.id,
          channelKind: ctx.channel.kind,
          sequence: event.data.sequence,
          role: "assistant",
          content,
          turnId: event.data.turnId,
          finishReason: event.data.finishReason,
        });
        if (conversationRequestEnvelope(ctx.session.auth.current) && event.data.finishReason === "stop") {
          if (!persisted || !attributes) throw new Error("Conversation response was not persisted");
          Object.assign(attributes, { conversationResponseMessageId: persisted.id,
            conversationResponseTurnId: event.data.turnId });
        }
      } catch (error) {
        console.error(
          "persist-conversation (assistant) failed:",
          error instanceof Error ? error.message : "unknown",
        );
        if (conversationRequestEnvelope(ctx.session.auth.current)) throw error;
      }
    },
    async "action.result"(event, ctx) {
      if (ctx.session.parent) return;
      const envelope = conversationRequestEnvelope(ctx.session.auth.current);
      if (!envelope) return;
      if (conversationRecordingEnabled()) return;
      const question = parseConversationQuestionResult(event);
      if (!question) return;
      await withToolDeadline(TOOL_DEADLINE.quick, () => recordConversationQuestion(envelope, {
        requestId: envelope.requestId, leaseToken: envelope.leaseToken,
        sessionId: ctx.session.id, turnId: event.data.turnId,
      }, question), true);
    },
    async "input.requested"(_event, ctx) {
      if (!ctx.session.parent && conversationRequestEnvelope(ctx.session.auth.current)) {
        Object.assign(ctx.session.auth.current!.attributes, { conversationAwaitingParent: "true" });
      }
    },
    async "authorization.completed"(_event, ctx) {
      // OAuth resumes the original turn without another turn.started event.
      // A callback is not proof of connection success or renewed family access.
      await withToolDeadline(TOOL_DEADLINE.quick, async () => {
        await requireConversationRequestAccess(ctx.session, "execute");
        await requireConversationJobAccess(ctx.session, "execute");
      }, true);
    },
    async "authorization.required"(_event, ctx) {
      if (!ctx.session.parent && conversationRequestEnvelope(ctx.session.auth.current)) {
        Object.assign(ctx.session.auth.current!.attributes, { conversationAwaitingParent: "true" });
      }
    },
    async "turn.completed"(event, ctx) {
      if (ctx.session.parent) return;
      const envelope = conversationRequestEnvelope(ctx.session.auth.current);
      if (!envelope || envelope.attributes.conversationAwaitingParent === "true") return;
      if (conversationRecordingEnabled()) return;
      const question = await finishConversationQuestionTurn(envelope, {
        requestId: envelope.requestId, leaseToken: envelope.leaseToken,
        sessionId: ctx.session.id, turnId: event.data.turnId,
      });
      if (question) return;
      const responseId = envelope.attributes.conversationResponseTurnId === event.data.turnId
        ? envelope.attributes.conversationResponseMessageId : undefined;
      await observeConversationRequestOutcome(envelope, {
        requestId: envelope.requestId, leaseToken: envelope.leaseToken,
        sessionId: ctx.session.id, turnId: event.data.turnId,
        outcome: typeof responseId === "string" ? "completed" : "recovery_required",
        responseMessageId: typeof responseId === "string" ? responseId : undefined,
      });
    },
    async "turn.failed"(event, ctx) {
      if (ctx.session.parent) return;
      const envelope = conversationRequestEnvelope(ctx.session.auth.current);
      if (!envelope) return;
      await observeConversationRequestOutcome(envelope, { requestId: envelope.requestId,
        leaseToken: envelope.leaseToken, sessionId: ctx.session.id,
        turnId: event.data.turnId, outcome: "recovery_required" });
    },
  },
});
