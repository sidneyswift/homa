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
  build: {
    // The material preview rasterizer (lib/materials/rasterize-pdf.ts,
    // HOMA-M1): pdf.js and its native canvas backend must ship as real
    // node_modules in the hosted build, never inlined into the bundle,
    // or the deployed function cannot resolve the platform binary and
    // previews fall back to screenshots that may not match the PDF.
    externalDependencies: ["pdfjs-dist", "@napi-rs/canvas"],
  },
});
