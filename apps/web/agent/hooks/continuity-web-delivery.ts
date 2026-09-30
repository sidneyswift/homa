import { defineHook } from "eve/hooks";

import { bindDeliveredProgressCheckIn } from "../../lib/child-progress/delivery-binding.server";
import { isWebDeliveryChannel } from "../../lib/child-progress/screen-delivery";
import {
  openReplyLoop,
  recordReactiveDelivery,
} from "../../lib/conversation-continuity/delivery-ledger";
import { replyContractForReactiveMessage } from "../../lib/conversation-continuity/delivery-policy";
import { persistCanonicalMessage } from "../../lib/conversation-continuity/ledger";
import { isParentedEveSession } from "../../lib/conversation-continuity/session-lineage";

/**
 * A completed web or native text stream is a real delivery to the signed-in adult. Record it
 * in the same per-recipient ledger as SMS/email so a new device or rotated Eve
 * session can resolve the question Homa visibly asked.
 */
export const screenDeliveryHook = {
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
        voiceBridge?: string;
      };
      if (
        !isWebDeliveryChannel(attributes.channel) ||
        // Native bridge speech retains its existing voice delivery protocol.
        (attributes.channel === "mobile" && attributes.voiceBridge === "true") ||
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
              // A committed tool can time out before its question card is
              // emitted. A pending turn alone is never delivery proof.
              deliveredContent: persisted.content,
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
} satisfies Parameters<typeof defineHook>[0];

export default defineHook(screenDeliveryHook);
