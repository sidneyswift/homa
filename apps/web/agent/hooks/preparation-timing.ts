import { withTimedHooks } from "../../lib/observability/chat-timing-hooks";
import { defineHook } from "eve/hooks";

import { markChatPreparation } from "../../lib/observability/chat-preparation";

/** Stream boundaries only. Never pass event content or auth into the logger. */
export default defineHook(withTimedHooks("preparation-timing", {
  events: {
    "step.started"(event, ctx) {
      markChatPreparation("agent_step_started", ctx.session.id, {
        turnId: event.data.turnId,
        sequence: event.data.sequence,
        stepIndex: event.data.stepIndex,
      });
    },
    "message.appended"(event, ctx) {
      // Cumulative length identifies each text block's first nonempty delta
      // without retaining state across workers. Use the earliest turn marker:
      // Eve can start another block within a step, and this runs after writing
      // the durable stream, before any guarantee of browser visibility.
      if (!event.data.messageDelta.length ||
          event.data.messageSoFar.length !== event.data.messageDelta.length) return;
      markChatPreparation("first_message_appended", ctx.session.id, {
        turnId: event.data.turnId,
        sequence: event.data.sequence,
        stepIndex: event.data.stepIndex,
      });
    },
  },
}));
