import { defineInstrumentation } from "eve/instrumentation";

import { registerTimingFetch } from "../lib/observability/chat-timing-io";
import { registerChatTiming } from "../lib/observability/chat-timing-server";
import { timingId, timingMark } from "../lib/observability/chat-timing";

export default defineInstrumentation({
  recordInputs: false,
  recordOutputs: false,
  setup() { registerChatTiming(); registerTimingFetch(); },
  events: {
    "step.started"(input) {
      const sendId = timingId(input.session.auth.current?.attributes.chatTimingId);
      timingMark("model.input_ready", { sendId, sessionId: input.session.id, turnId: input.turn.id, stepIndex: input.step.index });
      return { runtimeContext: { "homa.send.id": sendId ?? "" } };
    },
  },
});
