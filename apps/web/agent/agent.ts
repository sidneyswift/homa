import { defineAgent } from "eve";

import { HOMA_MODEL, HOMA_REASONING } from "./model";

export default defineAgent({
  // Gateway-routed model id (shared with the report writer via model.ts);
  // swapped per model-mix experiments (T2).
  // Eve session compaction runs on the active turn model and triggers
  // earlier than the 0.9 default per docs/homa-planning/01-architecture.md
  // (session-rotation design).
  model: HOMA_MODEL,
  reasoning: HOMA_REASONING,
  ...(process.env.VERCEL_ENV === "preview" &&
  process.env.HOMA_PREVIEW_ASTRA_PRIORITY === "1"
    ? {
        modelOptions: {
          providerOptions: { gateway: { serviceTier: "priority" } },
        },
      }
    : {}),
  // GPT-6 Astra exposes a 1,050,000-token context window. Pin it here so
  // eve build does not depend on a live Gateway model-catalog fetch to
  // compile the compaction trigger.
  modelContextWindowTokens: 1_050_000,
  compaction: {
    thresholdPercent: 0.75,
  },
  build: {
    // The material preview rasterizer (lib/materials/rasterize-pdf.ts,
    // HOMA-M1): pdf.js and its native canvas backend must ship as real
    // node_modules in the hosted build, never inlined into the bundle,
    // or the deployed function cannot resolve the platform binary and
    // previews fall back to screenshots that may not match the PDF.
    // The Telnyx adapter reads its own package.json relative to import.meta.url.
    // Eve 0.54 runtime bundling moves it away from that file unless external.
    // Sharp resolves a platform binary relative to its package. Inlining it
    // made the gh#1171 Linux preview fail before accepting a text-only turn.
    externalDependencies: ["pdfjs-dist", "@napi-rs/canvas", "@telnyx/chat-sdk-adapter", "sharp"],
  },
});
