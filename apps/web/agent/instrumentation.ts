import { defineInstrumentation } from "eve/instrumentation";

import { markChatPreparation } from "../lib/observability/chat-preparation";
import { previewModelTimingEnabled, registerPreviewChatModelTiming } from "../lib/observability/chat-model-timing";

export default defineInstrumentation({
  recordInputs: false,
  recordOutputs: false,
  setup: registerPreviewChatModelTiming,
  events: {
    "step.started"(input) {
      if (previewModelTimingEnabled()) {
        markChatPreparation("model_input_ready", input.session.id, {
          turnId: input.turn.id, sequence: input.turn.sequence, stepIndex: input.step.index,
        });
      }
      return undefined;
    },
  },
});
