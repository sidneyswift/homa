import { defineAgent } from "eve";

import { HOMA_MODEL } from "./model";

export default defineAgent({
  // Gateway-routed model id (shared with the report writer via model.ts);
  // swapped per model-mix experiments (T2).
  // Compaction runs on a cheaper model and triggers earlier than the 0.9 default
  // per docs/homa-planning/01-architecture.md (session-rotation design).
  model: HOMA_MODEL,
  compaction: {
    thresholdPercent: 0.75,
  },
});
