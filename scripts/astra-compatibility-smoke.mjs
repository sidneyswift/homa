/** Synthetic gateway compatibility checks. No production tools or records. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs, parseEnv } from "node:util";

import { generateObject, generateText, stepCountIs, tool } from "../apps/web/node_modules/ai/dist/index.js";
import { z } from "../apps/web/node_modules/zod/index.js";
import { homaModelSettings } from "../apps/web/agent/model.ts";

const { values } = parseArgs({ options: { env: { type: "string" }, out: { type: "string", default: "/private/tmp/homa-astra-compatibility.json" } } });
if (values.env) {
  const env = parseEnv(readFileSync(values.env, "utf8"));
  if (env.VERCEL_OIDC_TOKEN) process.env.VERCEL_OIDC_TOKEN = env.VERCEL_OIDC_TOKEN;
}
assert.ok(process.env.VERCEL_OIDC_TOKEN, "Vercel OIDC is required");
const common = {
  ...homaModelSettings(),
  maxRetries: 0,
  abortSignal: AbortSignal.timeout(120_000),
  providerOptions: { gateway: { disallowPromptTraining: true, tags: ["astra_compatibility_smoke"] } },
};
const structured = await generateObject({
  ...common,
  maxOutputTokens: 1024,
  schema: z.object({ activity: z.string(), minutes: z.number() }),
  prompt: "Synthetic test: propose one counting activity lasting exactly 10 minutes. Return the activity and minutes.",
});
assert.equal(structured.object.minutes, 10);
assert.ok(structured.object.activity.length > 0);
let calls = 0;
const tools = await generateText({
  ...common,
  maxOutputTokens: 4096,
  prompt: "Synthetic test: call getMaterials to learn which objects are available, then recommend a counting game using those objects. Keep the response under 50 words.",
  tools: {
    getMaterials: tool({
      description: "Return a fixed list of toy objects for this synthetic test.",
      inputSchema: z.object({}),
      execute: async () => { calls++; return { objects: ["five wooden blocks", "one bowl"] }; },
    }),
  },
  prepareStep: ({ stepNumber }) => ({ toolChoice: stepNumber === 0 ? "required" : "auto" }),
  stopWhen: stepCountIs(3),
});
assert.ok(calls > 0, "Expected the synthetic tool to execute");
assert.ok(tools.text.length > 0, "Expected a response after the tool result");
assert.ok(tools.steps.some((step) => step.toolResults.length > 0));
const receipt = {
  checkedAt: new Date().toISOString(),
  settings: homaModelSettings(),
  structuredOutput: { passed: true, object: structured.object, warnings: structured.warnings, usage: structured.usage },
  toolRoundTrip: { passed: true, calls, steps: tools.steps.length, text: tools.text, warnings: tools.warnings, usage: tools.totalUsage },
};
writeFileSync(values.out, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
