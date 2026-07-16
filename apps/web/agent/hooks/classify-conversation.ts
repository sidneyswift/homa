import { defineHook } from "eve/hooks";

import { classifyConversation } from "../../lib/signals/classify";
import { writeSignals } from "../../lib/signals/store";

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
        const attributes = ctx.session.auth.current?.attributes as
          | { familyId?: string }
          | undefined;
        const familyId = attributes?.familyId;
        if (!familyId) return;

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
