import { defineHook } from "eve/hooks";

import { markChatPreparation } from "../../lib/observability/chat-preparation";
import { createChatAppendObserver } from "../../lib/observability/chat-append-observation";

const observeAppend = createChatAppendObserver();

/** Stream boundaries only. Never pass event content or auth into the logger. */
export default defineHook({
  events: {
    "step.started"(event, ctx) {
      markChatPreparation("agent_step_started", ctx.session.id, {
        turnId: event.data.turnId,
        sequence: event.data.sequence,
        stepIndex: event.data.stepIndex,
      });
    },
    "message.appended"(event, ctx) {
      // These hooks run after the durable append, not after browser rendering.
      // Delta-only streams receive a distinct, worker-observation marker.
      const stage = observeAppend(ctx.session.id, event.data);
      if (!stage) return;
      markChatPreparation(stage, ctx.session.id, {
        turnId: event.data.turnId,
        sequence: event.data.sequence,
        stepIndex: event.data.stepIndex,
      });
    },
  },
});
