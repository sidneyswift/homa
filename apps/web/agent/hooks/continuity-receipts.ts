import { withTimedHooks } from "../../lib/observability/chat-timing-hooks";
import { defineHook } from "eve/hooks";

import {
  completeInboundReceipt,
  failInboundReceipt,
} from "../../lib/conversation-continuity/inbound-receipts";

function receiptId(attributes: unknown): string | null {
  const value = (attributes as { inboundReceiptId?: unknown } | undefined)
    ?.inboundReceiptId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Marks the inbound provider event processed when the agent reaches terminal
 * output. Outbound delivery has its own ledger and retry state, so a failed
 * response send can never replay the parent's tools or writes.
 */
export default defineHook(withTimedHooks("continuity-receipts", {
  events: {
    async "message.completed"(event, ctx) {
      if (event.data.finishReason !== "stop") return;
      const id = receiptId(ctx.session.auth.current?.attributes);
      if (id) await completeInboundReceipt(id);
    },
    async "turn.failed"(event, ctx) {
      const id = receiptId(ctx.session.auth.current?.attributes);
      if (id) await failInboundReceipt(id, event.data);
    },
    async "session.failed"(event, ctx) {
      const id = receiptId(ctx.session.auth.current?.attributes);
      if (id) await failInboundReceipt(id, event.data);
    },
  },
}));
