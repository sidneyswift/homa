import { defineHook } from "eve/hooks";

import { classifyConversation } from "../../lib/signals/classify";
import { writeSignals } from "../../lib/signals/store";

/** Internal agent work is not a family conversation and cannot create signals. */
export function shouldSkipConversationClassification(
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

/**
 * Layer 1: Signal classification hook.
 * Runs on message.completed (after persist-conversation has written the
 * messages). Classifies the conversation for signals and writes them to
 * conversation_signals. Best-effort: classification failures never break
 * the agent turn.
 */
export default defineHook({
  events: {
    async "message.completed"(event, ctx) {
      try {
        const attributes = ctx.session.auth.current?.attributes;
        if (shouldSkipConversationClassification(attributes)) return;
        const familyId = attributes?.familyId;
        if (typeof familyId !== "string" || familyId.length === 0) return;

        // The completed event carries the final assistant message.
        // Build a minimal single-message list for classification.
        const content = event.data.message;
        if (!content) return;

        const messages = [
          { role: "assistant" as const, content },
        ];

        const signals = await classifyConversation(
          ctx.session.id,
          familyId,
          messages,
        );

        if (signals.length > 0) {
          await writeSignals(familyId, ctx.session.id, signals);
        }
      } catch {
        // Best-effort: never break the agent turn for classification.
      }
    },
  },
});
