import { defineHook } from "eve/hooks";

import { bindDeliveredProgressCheckIn } from "../../lib/child-progress/delivery-binding.server";
import {
  openReplyLoop,
  recordReactiveDelivery,
} from "../../lib/conversation-continuity/delivery-ledger";
import { replyContractForReactiveMessage } from "../../lib/conversation-continuity/delivery-policy";
import { persistCanonicalMessage } from "../../lib/conversation-continuity/ledger";
import { isParentedEveSession } from "../../lib/conversation-continuity/session-lineage";

/**
 * A completed web stream is a real delivery to the signed-in adult. Record it
 * in the same per-recipient ledger as SMS/email so a new device or rotated Eve
 * session can resolve the question Homa visibly asked.
 */
export function isWebDeliveryChannel(channel: unknown): boolean {
  return channel === undefined || channel === "web";
}

export default defineHook({
  events: {
    async "message.completed"(event, ctx) {
      if (isParentedEveSession(ctx.session.parent)) {
        return;
      }

      if (event.data.finishReason !== "stop" || !event.data.message?.trim()) {
        return;
      }
      const attributes = (ctx.session.auth.current?.attributes ?? {}) as {
        channel?: string;
        familyId?: string;
        memberUserId?: string;
      };
      if (
        !isWebDeliveryChannel(attributes.channel) ||
        !attributes.familyId ||
        !attributes.memberUserId
      ) {
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
      const recorded = await recordReactiveDelivery({
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
      const progress =
        event.data.turnId
          ? await bindDeliveredProgressCheckIn({
              attempt: recorded.attempt,
              deliveryOutcome: recorded.deliveryOutcome,
              runtimeSessionId: ctx.session.id,
              turnId: event.data.turnId,
            })
          : { status: "no_unique_prompt" as const };
      const genericContract = replyContractForReactiveMessage(
        event.data.message,
      );
      if (
        progress.status !== "bound" &&
        recorded.deliveryOutcome === "sent" &&
        genericContract
      ) {
        await openReplyLoop({
          attempt: recorded.attempt,
          contract: genericContract,
        });
      }
    },
  },
});
