/** Paired prompt experiment with the real model and synthetic tool effects.
 * No database, artifacts, messages or background jobs are created. Provider
 * usage includes this harness's tool schemas and repeated model steps, not
 * the full production tool catalog. Live Eve evals cover that separate path. */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { HOMA_MODEL, HOMA_REASONING } from "../../agent/model";
import { applyEvalIsolation } from "../../lib/eval-isolation";

applyEvalIsolation(process.env);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const args = process.argv.slice(2);
const baseline = args[args.indexOf("--baseline") + 1];
const output = args[args.indexOf("--output") + 1];
if (!args.includes("--baseline") || !args.includes("--output") || !/^[a-f0-9]{40}$/.test(baseline)) {
  throw new Error("Supply --baseline <full commit> --output <result.json>");
}
const names = readdirSync(path.join(root, "apps/web/agent/skills")).sort();
const childId = "10000000-0000-4000-8000-000000000001";
const materialId = "20000000-0000-4000-8000-000000000001";
const cases = [
  { id: "reopen", prompt: "Please reopen Alex's saved Dinosaur counting mat from Binder.", required: "show_material" },
  { id: "background", prompt: "We agreed on Alex's 12-week counting program, one week per stage, starting with counting to five and then to ten. I approve that scope. Please start the background build now.", required: "start_agent_job" },
  { id: "quoted-negative", prompt: "Rewrite this sentence to sound friendlier: 'Create a worksheet and schedule it for Monday.' Only rewrite the sentence.", required: null },
] as const;
const results = [];
for (const scenario of cases) {
  for (const version of ["baseline", "candidate"] as const) {
    const read = (file: string) => version === "baseline"
      ? execFileSync("git", ["show", `${baseline}:${file}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      : readFileSync(path.join(root, file), "utf8");
    const calls: Array<{ name: string; input: unknown }> = [];
    const record = (name: string, input: unknown) => { calls.push({ name, input }); };
    const catalog = names.map((name) => `${name}: ${read(`apps/web/agent/skills/${name}/SKILL.md`).match(/^description: (.+)$/m)?.[1]}`).join("\n");
    const tools = {
      load_skill: tool({ description: "Load an advertised fleet skill.", inputSchema: z.object({ skill: z.enum(names as [string, ...string[]]) }), execute: async (input) => {
        record("load_skill", input);
        return read(`apps/web/agent/skills/${input.skill}/SKILL.md`).replace(/^---[\s\S]*?---\s*/, "");
      } }),
      read_file: tool({ description: "Read a skill reference by absolute /workspace/skills path.", inputSchema: z.object({ filePath: z.string() }), execute: async (input) => {
        record("read_file", input);
        const prefix = "/workspace/skills/";
        const rel = input.filePath.slice(prefix.length);
        if (!input.filePath.startsWith(prefix) || rel.split("/").some((part) => part === "..") || !rel.endsWith(".md")) return { error: "Invalid reference path" };
        try { return { content: read(`apps/web/agent/skills/${rel}`), truncated: false }; }
        catch { return { error: "Reference does not exist" }; }
      } }),
      find_materials: tool({ description: "Find saved Homa materials by title.", inputSchema: z.object({ title: z.string(), childId: z.string().optional() }), execute: async (input) => {
        record("find_materials", input);
        return { materials: [{ id: materialId, title: "Dinosaur counting mat", childId, status: "final", pageCount: 1 }] };
      } }),
      show_material: tool({ description: "Reopen the exact saved material without rebuilding it.", inputSchema: z.object({ materialId: z.string() }), execute: async (input) => {
        record("show_material", input); return { shown: input.materialId === materialId, materialId };
      } }),
      start_agent_job: tool({ description: "Start a finite background curriculum job after the parent confirms its scope. Its receipt confirms work continues after this reply.", inputSchema: z.object({ skill: z.literal("curriculum-studio"), title: z.string(), plan: z.object({ scope: z.string(), sequence: z.array(z.string()) }), totalStages: z.number().int(), childId: z.string() }), execute: async (input) => {
        record("start_agent_job", input); return { started: true, jobId: "synthetic-job", status: "queued", note: "The approved program is queued. No completion estimate is available yet." };
      } }),
      create_task: tool({ description: "Create scheduled or recurring work, not a finite curriculum build.", inputSchema: z.object({ title: z.string() }), execute: async (input) => {
        record("create_task", input); return { created: false, note: "Use a finite job for this request." };
      } }),
    };
    const start = Date.now();
    try {
      const result = await generateText({
        model: HOMA_MODEL,
        providerOptions: { openai: { reasoningEffort: HOMA_REASONING } },
        system: [read("apps/web/agent/instructions.md"), "## Available fleet skills", catalog,
          "## Authenticated synthetic family data", JSON.stringify({ parent: "Sam", child: { id: childId, name: "Alex", age: 6, interests: ["dinosaurs"], currentEvidence: "Counts five objects independently; learning to count ten" } })].join("\n\n"),
        prompt: scenario.prompt, tools, stopWhen: stepCountIs(12), maxOutputTokens: 2500,
        maxRetries: 0, abortSignal: AbortSignal.timeout(180_000),
      });
      const passed = scenario.required ? calls.some((call) => call.name === scenario.required)
        && !calls.some((call) => call.name === "create_task") : calls.length === 0;
      const row = { case: scenario.id, version, passed, elapsedMs: Date.now() - start,
        inputTokens: result.totalUsage.inputTokens, outputTokens: result.totalUsage.outputTokens,
        steps: result.steps.length, calls, text: result.text };
      results.push(row);
      console.log(JSON.stringify({ case: row.case, version, passed, inputTokens: row.inputTokens, steps: row.steps }));
    } catch (error) {
      results.push({ case: scenario.id, version, passed: false, error: error instanceof Error ? error.message : "Unknown error", calls });
      console.log(JSON.stringify({ case: scenario.id, version, passed: false, error: "Model run failed; inspect result file" }));
    }
    writeFileSync(output, JSON.stringify({ model: HOMA_MODEL, reasoning: HOMA_REASONING, baseline,
      scope: "Synthetic tool effects and reduced schemas. Input tokens include all model steps in this harness; this is not a production latency benchmark.", results }, null, 2) + "\n");
  }
}
if (results.some((row) => !row.passed && row.version === "candidate")) process.exitCode = 1;
