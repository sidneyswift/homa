/** Synthetic inference screen only. It cannot establish browser-to-answer latency. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";

import { streamText, jsonSchema } from "../apps/web/node_modules/ai/dist/index.js";
import { composeRuntimeBasePrompt } from "../apps/web/node_modules/eve/dist/src/runtime/prompt/compose.js";
import { getFrameworkToolDefinitions } from "../apps/web/node_modules/eve/dist/src/runtime/framework-tools/index.js";
import { buildToolSetWithProviderTools } from "../apps/web/node_modules/eve/dist/src/harness/tools.js";
import { raceFirstText } from "./latency-first-text-race.mjs";

const { values } = parseArgs({ options: {
  env: { type: "string" }, out: { type: "string" },
  rounds: { type: "string", default: "4" },
} });
assert.ok(values.out, "Use a unique output file; existing experiments are never overwritten");
const rounds = Number(values.rounds);
assert.ok(Number.isInteger(rounds) && rounds >= 1 && rounds <= 8);
const env = values.env ? parseEnv(readFileSync(values.env, "utf8")) : {};
if (env.VERCEL_OIDC_TOKEN) process.env.VERCEL_OIDC_TOKEN = env.VERCEL_OIDC_TOKEN;
assert.ok(process.env.VERCEL_OIDC_TOKEN, "Vercel OIDC required");
const manifestBytes = readFileSync("apps/web/.eve/compile/compiled-agent-manifest.json", "utf8");
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.config.model.id, "openai/gpt-6-astra");
const instructions = composeRuntimeBasePrompt({ instructions: manifest.instructions, connections: [],
  skills: manifest.skills, toolsAvailable: true,
  workspaceSpec: { rootEntries: manifest.workspaceResourceRoot?.rootEntries ?? [] },
}).join("\n\n");
const names = new Set(manifest.tools.map(definition => definition.name));
const definitions = [...getFrameworkToolDefinitions({ hasConnections: false })
  .filter(definition => !names.has(definition.name) && !manifest.disabledFrameworkTools.includes(definition.name)), ...manifest.tools];
const tools = await buildToolSetWithProviderTools({ modelReference: manifest.config.model,
  capabilities: { requestInput: true }, tools: new Map(definitions.map(({ name, description, inputSchema }) =>
    [name, { name, description, inputSchema: inputSchema === null ? undefined : jsonSchema(inputSchema) }])) });
assert.ok(Object.values(tools).every(tool => tool.execute === undefined));
const prompts = [
  { id: "phonics", messages: [{ role: "user", content: "What does phonics mean? Answer in one short sentence." }] },
  { id: "frustration", messages: [{ role: "user", content: "Give me one sentence I can say when a child feels frustrated by a hard task." }] },
  { id: "shorter", messages: [{ role: "user", content: "Give me one sentence I can say when a child feels frustrated." },
    { role: "assistant", content: "This feels hard right now, and we can take a breath and try one small step together." },
    { role: "user", content: "Make that sentence shorter." }] },
];
const slots = [];
for (let round = 0; round < rounds; round++) for (let index = 0; index < prompts.length; index++) {
  for (const copies of (round + index) % 2 ? [2, 1] : [1, 2]) {
    slots.push({ id: `round-${round + 1}-${prompts[index].id}-${copies}`, round: round + 1, promptId: prompts[index].id, copies });
  }
}
const hash = value => createHash("sha256").update(value).digest("hex");
const report = {
  version: 1, startedAt: new Date().toISOString(), model: "openai/gpt-6-astra", reasoning: "medium",
  scope: "Local Node through Gateway OIDC. Compiled Homa static prompt and tool catalog with synthetic context; tools disabled. No app overhead, family access or durable writes. Diagnostic only, not acceptance.",
  settings: { rounds, copies: [1, 2], hedgeDelayMs: 0, maxRetries: 0, maxOutputTokens: 8192,
    deadlineMs: 90000, toolChoice: "none", toolCount: Object.keys(tools).length, warmup: "None; retain every first request" },
  manifestSha256: hash(manifestBytes), staticInstructionsSha256: hash(instructions),
  prompts, slots, samples: [],
};
mkdirSync(dirname(resolve(values.out)), { recursive: true });
writeFileSync(values.out, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
const save = () => writeFileSync(values.out, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
for (const slot of slots) {
  const prompt = prompts.find(prompt => prompt.id === slot.promptId);
  const usage = [];
  const sample = { ...slot, startedAt: new Date().toISOString(), status: "pending" };
  report.samples.push(sample); save();
  const result = await raceFirstText({ copies: slot.copies, signal: AbortSignal.timeout(report.settings.deadlineMs),
    open: ({ index, signal }) => streamText({ model: report.model, reasoning: report.reasoning,
      system: instructions + "\n\nSynthetic read-only evaluation: no authenticated family context is supplied. Answer these general language questions directly. Tool execution is disabled.",
      messages: prompt.messages, tools, toolChoice: "none", maxRetries: 0, maxOutputTokens: report.settings.maxOutputTokens,
      abortSignal: signal, providerOptions: { gateway: { caching: "auto", disallowPromptTraining: true, tags: ["homa_astra_race_screen"] } },
      onError: () => {},
      onFinish: event => { usage.push({ index, usage: event.totalUsage, finishReason: event.finishReason,
        // Retain only non-secret routing/service fields, never request/response bodies.
        gateway: { serviceTier: event.providerMetadata?.gateway?.serviceTier,
          finalProvider: event.providerMetadata?.gateway?.routing?.finalProvider } }); },
    }).fullStream,
  });
  Object.assign(sample, result, { usage }); save();
  console.log(JSON.stringify({ id: slot.id, status: result.status, firstTextMs: result.firstTextMs,
    winner: result.winner, attempts: result.attempts.map(({ index, status }) => ({ index, status })) }));
  if (result.status !== "completed") {
    report.stoppedReason = "A logical sample did not complete; retain it and investigate before continuing.";
    break;
  }
}
report.finishedAt = new Date().toISOString(); save();
