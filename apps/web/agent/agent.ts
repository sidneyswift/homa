import { defineAgent } from "eve";

import { timedGatewayModel } from "../lib/observability/chat-timing-model";

import { createHomaTurnModel } from "../lib/turn-model";
import { turnModelState } from "./turn-model-state";
import { HOMA_MODEL, HOMA_REASONING } from "./model";
import { FAST_MODELS, routedGatewayModel } from "../lib/model-router/router";
import { timingRecord } from "../lib/observability/chat-timing";
import { modelRouterState } from "./model-router-state";

const conversationalModel = routedGatewayModel({
  candidate: () => process.env.HOMA_MODEL_ROUTER === "luna" ? FAST_MODELS.luna : process.env.HOMA_MODEL_ROUTER === "flash" ? FAST_MODELS.flash : undefined,
  resolveModel: timedGatewayModel,
  onRoute: (route) => {
    modelRouterState.update(() => route);
    timingRecord({ kind: "model.route", atMs: Date.now(), ...route });
  },
});

export default defineAgent({
  // Research uses Sonnet; conversations use Astra unless routing is enabled (gh#1209).
  // Eve session compaction runs on the active turn model and triggers
  // earlier than the 0.9 default per docs/homa-planning/01-architecture.md
  // (session-rotation design).
  model: createHomaTurnModel({
    currentModel: () => turnModelState.get(),
    resolveModel: (id) => id === HOMA_MODEL ? conversationalModel : timedGatewayModel(id),
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
