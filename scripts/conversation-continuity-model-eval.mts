/**
 * Model-level regression eval for the production continuity incident.
 *
 * The database/service tests prove the correct prior message is selected.
 * This eval proves Homa uses the role-labeled context correctly when the
 * current parent message is only "Yes".
 *
 * Usage: pnpm tsx scripts/conversation-continuity-model-eval.mts
 */

import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { generateText } from "../apps/web/node_modules/ai/dist/index.js";

import { HOMA_MODEL } from "../apps/web/agent/model";
import { renderContinuityContext } from "../apps/web/lib/conversation-continuity/reply-policy";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // CI supplies gateway credentials directly.
}

const instructions = readFileSync(
  path.join(repoRoot, "apps/web/agent/instructions.md"),
  "utf8",
);
const continuityContext = renderContinuityContext([
  {
    role: "user",
    visibility: "internal",
    content: "Internal instruction: compose the morning brief.",
    happenedAt: new Date("2026-07-11T13:18:26.000Z"),
  },
  {
    role: "assistant",
    visibility: "family",
    content:
      "Story is ready to practice self-regulation through movement. Want a quick stop-and-go game to try today?",
    happenedAt: new Date("2026-07-11T13:18:52.000Z"),
  },
]);

const result = await generateText({
  model: HOMA_MODEL,
  system: [
    instructions,
    "The current channel is SMS. Answer in one short text bubble.",
    continuityContext,
  ].join("\n\n"),
  prompt: "Yes",
  maxRetries: 1,
  providerOptions: {
    gateway: {
      disallowPromptTraining: true,
      tags: ["conversation_continuity_eval"],
    },
  },
});

const text = result.text.trim();
const confused = /yes to|what were you hoping|what do you mean/iu.test(text);
const answeredOffer = /game|stop|go|freeze|move|movement/iu.test(text);
console.log(text);
console.log(
  !confused && answeredOffer
    ? "\nPASS  Homa resolved Yes to the prior offer"
    : "\nFAIL  Homa lost the prior offer",
);
process.exit(!confused && answeredOffer ? 0 : 1);
