import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs, parseEnv } from "node:util";
import { streamText } from "../apps/web/node_modules/ai/dist/index.js";
import { chooseRoute, FAST_MODELS, routedGatewayModel, ROUTER_VERSION, type Route } from "../apps/web/lib/model-router/router";
import { HOMA_MODEL } from "../apps/web/agent/model";
import { routingCases } from "../apps/web/evals/model-router/cases";

const { values } = parseArgs({ options: { env: { type: "string" }, out: { type: "string" }, mode: { type: "string", default: "routing" }, rounds: { type: "string", default: "2" } } });
if (!values.env || !values.out) throw new Error("--env and --out required");
if (!["routing", "latency"].includes(values.mode)) throw new Error("Invalid mode");
const rounds = Number(values.rounds); if (!Number.isInteger(rounds) || rounds < 1 || rounds > 5) throw new Error("rounds must be 1..5");
const oidc = parseEnv(readFileSync(values.env, "utf8")).VERCEL_OIDC_TOKEN; if (!oidc) throw new Error("OIDC required"); process.env.VERCEL_OIDC_TOKEN = oidc;
// No production database, artifact credentials or tools are loaded.
const report = { version: ROUTER_VERSION, mode: values.mode, startedAt: new Date().toISOString(), rounds, boundary: "SDK invocation including actual routing until first nonempty answer text. Excludes application preparation and browser rendering.", samples: [] as Record<string, unknown>[] };
mkdirSync(dirname(values.out), { recursive: true }); const save = () => writeFileSync(values.out!, JSON.stringify(report, null, 2) + "\n"); save();
if (values.mode === "routing") {
  for (let round = 0; round < rounds; round++) for (const c of routingCases) {
    const state = JSON.stringify([{ role: "user", content: [{ type: "text", text: c.text }] }]);
    const route = await chooseRoute(state, FAST_MODELS.luna);
    const actual = route.model === HOMA_MODEL ? "astra" : "fast";
    const row = { id: c.id, round, expected: c.expected, actual, pass: c.expected === actual, ...route };
    report.samples.push(row); save(); console.log(JSON.stringify(row));
  }
} else {
  const system = readFileSync(new URL("../apps/web/agent/instructions.md", import.meta.url), "utf8") + "\nSynthetic evaluation: no tools, personal records, or file creation are available. Answer the current general question directly and briefly. Never claim an action happened.";
  const arms = ["astra", "luna", "flash", "routed-luna", "routed-flash"] as const;
  for (let round = 0; round < rounds; round++) for (const [index, c] of routingCases.slice(0, 4).entries()) {
    const offset = (round * 4 + index) % arms.length;
    for (let j = 0; j < arms.length; j++) {
      const arm = arms[(j + offset) % arms.length];
      let route: Route | undefined;
      const fast = arm.includes("flash") ? FAST_MODELS.flash : FAST_MODELS.luna;
      const model = arm.startsWith("routed-") ? routedGatewayModel({ candidate: () => fast, onRoute: r => { route = r; } }) : arm === "astra" ? HOMA_MODEL : fast;
      const row: Record<string, unknown> = { id: c.id, round, arm, text: "", ttftMs: null, status: "pending" };
      report.samples.push(row); save(); const start = performance.now();
      try {
        const result = streamText({ model, reasoning: arm === "astra" || arm.startsWith("routed-") ? "medium" : "low", system, prompt: c.text, maxRetries: 0, maxOutputTokens: 4096, abortSignal: AbortSignal.timeout(90000), providerOptions: { gateway: { disallowPromptTraining: true } }, onError: () => {} });
        for await (const p of result.fullStream) {
          if (p.type === "error") throw p.error;
          if (p.type === "text-delta" && p.text.length) { row.ttftMs ??= Math.round(performance.now() - start); row.text = String(row.text) + p.text; }
        }
        row.usage = await result.totalUsage; row.finishReason = await result.finishReason; row.warnings = await result.warnings;
        row.status = row.ttftMs === null ? "no_answer" : "ok";
      } catch (error) { row.status = "error"; row.error = error instanceof Error ? error.message.slice(0, 300) : "unknown"; }
      row.totalMs = Math.round(performance.now() - start); row.route = route; save();
      console.log(JSON.stringify({ ...row, text: undefined, usage: undefined }));
    }
  }
}
save();
