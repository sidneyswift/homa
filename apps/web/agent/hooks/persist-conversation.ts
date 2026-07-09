import { defineHook } from "eve/hooks";

import { persistConversationMessage } from "../../lib/conversation-log";

/**
 * The durable chat record (agentic ladder item 5, an M1-02 slice): every
 * user and assistant message, on EVERY channel (web chat and SMS), lands
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
 * Failure posture: hooks that throw fail the TURN (eve hooks contract),
 * so everything here is caught and logged; losing one history row must
 * never break a conversation. Idempotency rides the (session_id,
 * sequence) unique key, so replays and reconnects never duplicate.
 */
export default defineHook({
  events: {
    async "message.received"(event, ctx) {
      try {
        await persistConversationMessage({
          attributes: ctx.session.auth.current?.attributes,
          sessionId: ctx.session.id,
          channelKind: ctx.channel.kind,
          sequence: event.data.sequence,
          role: "user",
          content: event.data.message,
          turnId: event.data.turnId,
        });
      } catch (error) {
        console.error(
          "persist-conversation (user) failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
    async "message.completed"(event, ctx) {
      try {
        if (!event.data.message) return;
        await persistConversationMessage({
          attributes: ctx.session.auth.current?.attributes,
          sessionId: ctx.session.id,
          channelKind: ctx.channel.kind,
          sequence: event.data.sequence,
          role: "assistant",
          content: event.data.message,
          turnId: event.data.turnId,
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
