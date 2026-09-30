import { defineAgent } from "eve";

import { createHomaTurnModel } from "../lib/turn-model";
import { HOMA_REASONING } from "./model";
import { turnModelState } from "./turn-model-state";

export default defineAgent({
  // Research uses Sonnet; user-facing turns retain Astra (gh#1209).
  // Eve session compaction runs on the active turn model and triggers
  // earlier than the 0.9 default per docs/homa-planning/01-architecture.md
  // (session-rotation design).
  model: createHomaTurnModel({ currentModel: () => turnModelState.get() }),
  reasoning: HOMA_REASONING,
  // Use the smaller research window for safe compaction on either model;
  // pinning also keeps Eve builds independent of the live model catalog.
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
