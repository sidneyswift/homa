/**
 * Request-to-first-response-text-token benchmark, never reasoning or SSE setup.
 * Run with Node 24: node scripts/astra-response-ttft.mjs --env /absolute/.env.local
 * Synthetic inputs only; no Homa tools, family records, or durable writes.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";

import { streamText } from "../apps/web/node_modules/ai/dist/index.js";

const { values } = parseArgs({ options: {
  env: { type: "string" },
  out: { type: "string", default: "/private/tmp/homa-astra-response-ttft.json" },
  rounds: { type: "string", default: "2" },
  levels: { type: "string", default: "low,medium,high,xhigh,max" },
} });
// Load only the OIDC credential, not production database or artifact credentials.
if (values.env) {
  const env = parseEnv(readFileSync(values.env, "utf8"));
  if (env.VERCEL_OIDC_TOKEN) process.env.VERCEL_OIDC_TOKEN = env.VERCEL_OIDC_TOKEN;
}
if (!process.env.VERCEL_OIDC_TOKEN) throw new Error("Vercel OIDC is required.");
const levels = values.levels.split(",");
if (!levels.length || levels.some((level) => !["low", "medium", "high", "xhigh", "max"].includes(level))) {
  throw new Error("Unknown Astra reasoning level.");
}
const rounds = Number(values.rounds);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) throw new Error("rounds must be 1..10");
const system = "You are a helpful homeschool planning assistant in a synthetic latency benchmark. Answer the parent directly in at most 80 words. No tools or personal records are available. Do not claim to save or create anything.";
const prompts = [
  { id: "quick_activity", text: "My five-year-old loves dinosaurs. What is one ten-minute counting game we can play with things already at home?" },
  { id: "parent_support", text: "Our homeschool morning fell apart and I feel guilty. What is one small thing we can do this afternoon to finish the day gently?" },
  { id: "lesson_plan", text: "Help me plan a 20-minute hands-on fractions activity for an eight-year-old using paper. Include a way to check understanding and an easier adjustment if it feels frustrating." },
];
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  model: "openai/gpt-6-astra",
  metric: "Milliseconds from streamText invocation to first nonempty text-delta; reasoning and all setup events excluded.",
  environment: "Local Node client through Vercel AI Gateway with OIDC; not browser-to-Homa latency.",
  systemSha256: createHash("sha256").update(system).digest("hex"),
  systemCharacters: system.length,
  prompts,
  settings: { rounds, levels, concurrency: 1, maxRetries: 0, maxOutputTokens: 8192, timeoutMs: 120000, providerRouting: "gateway default", warmup: "one request per level, excluded", order: "rotating effort order per prompt block" },
  samples: [],
};
mkdirSync(dirname(resolve(values.out)), { recursive: true });
function save() { writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`); }
save();

async function sample(level, prompt, round, warmup) {
  const row = { level, promptId: prompt.id, round, warmup, startedAt: new Date().toISOString(), ttftMs: null, totalMs: null, text: "", status: "pending" };
  const started = performance.now();
  try {
    const result = streamText({
      model: report.model,
      // max is a native OpenAI effort absent from the SDK's generic enum.
      ...(level === "max" ? {} : { reasoning: level }),
      system,
      prompt: prompt.text,
      maxRetries: 0,
      maxOutputTokens: report.settings.maxOutputTokens,
      abortSignal: AbortSignal.timeout(report.settings.timeoutMs),
      providerOptions: {
        ...(level === "max" ? { openai: { reasoningEffort: "max" } } : {}),
        gateway: { disallowPromptTraining: true, tags: ["astra_response_ttft", `effort_${level}`] },
      },
      onError: () => {},
    });
    for await (const part of result.fullStream) {
      if (part.type === "error") throw part.error;
      if (part.type === "text-delta" && part.text.length > 0) {
        row.ttftMs ??= Math.round(performance.now() - started);
        row.text += part.text;
      }
    }
    row.totalMs = Math.round(performance.now() - started);
    row.usage = await result.totalUsage;
    row.finishReason = await result.finishReason;
    row.warnings = await result.warnings;
    // Metadata is provider telemetry only; no request headers or OIDC tokens.
    row.providerMetadata = await result.providerMetadata;
    row.status = row.ttftMs === null ? "no_response_text" : "ok";
  } catch (error) {
    row.totalMs = Math.round(performance.now() - started);
    row.status = "error";
    row.error = { name: error?.name ?? "Error", message: String(error?.message ?? error).slice(0, 1000) };
  }
  report.samples.push(row);
  save();
  console.log(JSON.stringify({ level, prompt: prompt.id, round, warmup, ttftMs: row.ttftMs, status: row.status, error: row.error }));
  return row;
}

for (const level of levels) {
  const row = await sample(level, { id: "warmup", text: "Suggest one simple indoor counting game in a single sentence." }, 0, true);
  if (row.status !== "ok") {
    console.error("Warmup failed; stopping before the measured batch.");
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) {
  for (let round = 1; round <= rounds; round++) {
    for (let index = 0; index < prompts.length; index++) {
      const offset = ((round - 1) * prompts.length + index) % levels.length;
      for (let j = 0; j < levels.length; j++) {
        await sample(levels[(j + offset) % levels.length], prompts[index], round, false);
      }
    }
  }
}
function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
report.completedAt = new Date().toISOString();
report.summary = levels.map((level) => {
  const attempts = report.samples.filter((row) => row.level === level && !row.warmup);
  const times = attempts.filter((row) => row.status === "ok").map((row) => row.ttftMs);
  return { level, attempts: attempts.length, successes: times.length, failures: attempts.length - times.length,
    medianMs: times.length ? median(times) : null,
    meanMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    minMs: times.length ? Math.min(...times) : null, maxMs: times.length ? Math.max(...times) : null };
});
save();
console.log(JSON.stringify(report.summary, null, 2));
if (report.samples.some((row) => row.status !== "ok")) process.exitCode = 1;
