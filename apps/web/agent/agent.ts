import { defineAgent } from "eve";

export default defineAgent({
  // Gateway-routed model id; swapped per model-mix experiments (T2).
  // Compaction runs on a cheaper model and triggers earlier than the 0.9 default
  // per docs/homa-planning/01-architecture.md (session-rotation design).
  model: "anthropic/claude-sonnet-5",
  compaction: {
    thresholdPercent: 0.75,
  },
});
