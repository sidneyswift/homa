import { defineAgent } from "eve";

import { timedGatewayModel } from "../lib/observability/chat-timing-model";

import { HOMA_REASONING } from "./model";
import { FAST_MODELS, routedGatewayModel } from "../lib/model-router/router";
import { timingRecord } from "../lib/observability/chat-timing";
import { modelRouterState } from "./model-router-state";

export default defineAgent({
  // Gateway-routed model id (shared with the report writer via model.ts);
  // swapped per model-mix experiments (T2).
  // Eve session compaction runs on the active turn model and triggers
  // earlier than the 0.9 default per docs/homa-planning/01-architecture.md
  // (session-rotation design).
  model: routedGatewayModel({
    candidate: () => process.env.HOMA_MODEL_ROUTER === "luna" ? FAST_MODELS.luna : process.env.HOMA_MODEL_ROUTER === "flash" ? FAST_MODELS.flash : undefined,
    resolveModel: timedGatewayModel,
    onRoute: (route) => {
      modelRouterState.update(() => route);
      timingRecord({ kind: "model.route", atMs: Date.now(), ...route });
    },
  }),
  reasoning: HOMA_REASONING,
  // Use the smallest candidate context window (Flash: 1,000,000) so
  // eve build does not depend on a live Gateway model-catalog fetch to
  // compile the compaction trigger.
  modelContextWindowTokens: 1_000_000,
  compaction: {
    thresholdPercent: 0.75,
  },
  build: {
    // The material preview rasterizer (lib/materials/rasterize-pdf.ts,
    // HOMA-M1): pdf.js and its native canvas backend must ship as real
    // node_modules in the hosted build, never inlined into the bundle,
    // or the deployed function cannot resolve the platform binary and
    // previews fall back to screenshots that may not match the PDF.
    externalDependencies: ["pdfjs-dist", "@napi-rs/canvas"],
  },
});
