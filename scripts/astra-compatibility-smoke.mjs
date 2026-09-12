/** Synthetic gateway checks with compiled tool schemas, never tool execution or family records. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs, parseEnv } from "node:util";

import { generateObject, generateText, jsonSchema, stepCountIs, tool } from "../apps/web/node_modules/ai/dist/index.js";
import { z } from "../apps/web/node_modules/zod/index.js";
import { homaModelSettings } from "../apps/web/agent/model.ts";

const { values } = parseArgs({ options: { env: { type: "string" }, manifest: { type: "string", default: "apps/web/.eve/compile/compiled-agent-manifest.json" }, out: { type: "string", default: "/private/tmp/homa-astra-compatibility.json" } } });
const manifest = JSON.parse(readFileSync(values.manifest, "utf8"));
assert.ok(manifest.tools.length > 0, "Build the agent before checking its compiled tool catalog");
const catalog = Object.fromEntries(manifest.tools.map((definition) => [definition.name, tool({
  description: "Schema-only compatibility check. Do not call this tool.",
  inputSchema: jsonSchema(definition.inputSchema),
})]));
assert.equal(Object.keys(catalog).length, manifest.tools.length, "Tool names must be unique");
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
const catalogResult = await generateText({
  ...common,
  maxOutputTokens: 1024,
  prompt: "Synthetic compatibility check: reply with Ready. Do not call any tools.",
  tools: catalog,
  toolChoice: "none",
});
assert.ok(catalogResult.text.length > 0, "Expected an answer with the complete tool catalog attached");
assert.equal(catalogResult.toolCalls.length, 0);
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
  compiledToolCatalog: { passed: true, tools: manifest.tools.length, warnings: catalogResult.warnings, usage: catalogResult.totalUsage },
  structuredOutput: { passed: true, object: structured.object, warnings: structured.warnings, usage: structured.usage },
  toolRoundTrip: { passed: true, calls, steps: tools.steps.length, text: tools.text, warnings: tools.warnings, usage: tools.totalUsage },
};
writeFileSync(values.out, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
