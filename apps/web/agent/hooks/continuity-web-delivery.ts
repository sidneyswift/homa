import { defineHook } from "eve/hooks";

import { recordReactiveDelivery } from "../../lib/conversation-continuity/delivery-ledger";
import { persistCanonicalMessage } from "../../lib/conversation-continuity/ledger";

/**
 * A completed web stream is a real delivery to the signed-in adult. Record it
 * in the same per-recipient ledger as SMS/email so a new device or rotated Eve
 * session can resolve the question Homa visibly asked.
 */
export default defineHook({
  events: {
    async "message.completed"(event, ctx) {
      if (event.data.finishReason !== "stop" || !event.data.message?.trim()) {
        return;
      }
      const attributes = (ctx.session.auth.current?.attributes ?? {}) as {
        channel?: string;
        familyId?: string;
        memberUserId?: string;
      };
      if (attributes.channel || !attributes.familyId || !attributes.memberUserId) {
        return;
      }
      const persisted = await persistCanonicalMessage({
        attributes,
        sessionId: ctx.session.id,
        channel: "web",
        sequence: event.data.sequence,
        role: "assistant",
        content: event.data.message,
        turnId: event.data.turnId,
        terminal: true,
      });
      if (!persisted) return;
      await recordReactiveDelivery({
        familyId: attributes.familyId,
        episodeId: persisted.episodeId,
        messageId: persisted.id,
        memberUserId: attributes.memberUserId,
        channel: "web",
        destination: `member:${attributes.memberUserId}`,
        providerThreadKey: `web:${ctx.session.id}`,
        content: event.data.message,
        delivered: true,
      });
    },
  },
});
