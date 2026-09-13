import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const [packageDirectory, receiptPath] = process.argv.slice(2);
assert.ok(packageDirectory && receiptPath,
  "Usage: node scripts/eve-bounded-tool-replay-probe.mjs <candidate-package> <receipt.json>");
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const web = path.join(root, "apps/web");
const candidate = path.resolve(packageDirectory);
const metadata = JSON.parse(await readFile(path.join(candidate, "package.json"), "utf8"));
assert.equal(metadata.name, "eve");
assert.equal(metadata.version, "0.54.3", "Review the callback contract for another candidate");
const temporary = await mkdtemp(path.join(tmpdir(), "eve-bounded-replay-"));
const execute = promisify(execFile);
try {
  const paths = { "@/*": [path.join(web, "*")], zod: [path.join(web, "node_modules/zod/index.js")] };
  for (const [key, value] of Object.entries(metadata.exports)) {
    const target = typeof value === "string" ? value : value.import ?? value.default;
    if (typeof target === "string") paths[key === "." ? "eve" : `eve/${key.slice(2)}`] = [path.resolve(candidate, target)];
  }
  const config = path.join(temporary, "tsconfig.json");
  await writeFile(config, JSON.stringify({ extends: path.join(web, "tsconfig.json"), compilerOptions: { paths } }));
  const helperPath = path.join(web, "lib/agent-tool-deadline.ts");
  const helperSource = await readFile(helperPath, "utf8");
  const { transformDynamicToolExecute } = await import(pathToFileURL(path.join(candidate,
    "dist/src/internal/workflow-bundle/dynamic-tool-transform.js")).href);
  const transformed = await transformDynamicToolExecute(helperPath, helperSource);
  const compiledHelper = path.join(temporary, "compiled-helper.ts");
  await writeFile(compiledHelper, transformed?.code ?? helperSource);
  const probe = path.join(temporary, "probe.mts");
  await writeFile(probe, `
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { defineBoundedTool, ToolAccessBoundaryError, ToolDeadlineError } from ${JSON.stringify(compiledHelper)};
import { readDurableDynamicToolCallbacks } from ${JSON.stringify(path.join(candidate, "dist/src/tools/durable-callbacks.js"))};
${["ask_for_details", "ask_user_questions", "create_printable", "generate_image", "start_checklist"].map((name, index) => `import dynamic${index} from ${JSON.stringify(path.join(web, "agent/tools", `${name}.ts`))};`).join("\n")}
import progressBoundary from ${JSON.stringify(path.join(web, "agent/tools/progress_task_boundary.ts"))};
const webContext = { channel: { kind: "channel:eve", metadata: {} }, session: { auth: { current: { attributes: { channel: "web" } } } } };
const restrictedContext = { ...webContext, session: { auth: { current: { attributes: { channel: "progress_next_move" } } } } };
const boundaryTools = (progressBoundary.default ?? progressBoundary).events["step.started"]({}, restrictedContext);
assert.equal(Object.keys(boundaryTools).length, 7);
const actualTools = [
  ...[dynamic0, dynamic1, dynamic2, dynamic3, dynamic4].map(dynamic => (dynamic.default ?? dynamic).events["step.started"]({}, webContext)),
  ...Object.values(boundaryTools),
];
assert.ok(actualTools.every(Boolean), "All selected Homa tools must resolve");
const actualDescriptors = actualTools.map(tool => readDurableDynamicToolCallbacks(tool)?.execute);
assert.ok(actualDescriptors.every(Boolean), "All selected executors must be replayable");
const [mode, snapshotPath] = process.argv.slice(2);
let bodyRuns = 0;
const tool = defineBoundedTool({
  description: "Synthetic replay probe; no external effects",
  inputSchema: z.object({ hang: z.boolean().optional(), value: z.string().optional() }),
  deadlineMs: mode === "capture" ? 30 : 10_000,
  repeatable: mode !== "capture",
  allowProgressNextMove: mode !== "capture",
  execute(input) {
    bodyRuns++;
    if (input.hang) return new Promise(() => {});
    return { value: input.value ?? null };
  },
});
const descriptor = readDurableDynamicToolCallbacks(tool)?.execute;
assert.ok(descriptor, "Actual candidate must receive durable execute metadata");
if (mode === "capture") {
  assert.deepEqual(descriptor.closure, { deadlineMs: 30, repeatable: false, allowProgressNextMove: false });
  writeFileSync(snapshotPath, JSON.stringify({ synthetic: descriptor.closure, tools: actualDescriptors.map(item => item.closure) }));
} else {
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const saved = snapshot.synthetic;
  assert.equal(descriptor.closure.deadlineMs, 10_000, "Control uses different current policy");
  const call = (input, ctx = {}) => descriptor.callback(saved, input, ctx);
  assert.deepEqual(await call({ value: "fresh-process" }), { value: "fresh-process" });
  const runsBeforeDenied = bodyRuns;
  await assert.rejects(call({}, { session: { auth: { current: { attributes: { channel: "progress_next_move" } } } } }), ToolAccessBoundaryError);
  assert.equal(bodyRuns, runsBeforeDenied, "Saved access policy must deny before execution");
  const started = performance.now();
  await assert.rejects(call({ hang: true }), error => error instanceof ToolDeadlineError && error.repeatable === false);
  assert.ok(performance.now() - started < 2_000, "Saved deadline must win over the new ten-second policy");
  for (const [index, actual] of actualDescriptors.entries()) {
    await assert.rejects(actual.callback(snapshot.tools[index], {}, { session: { auth: { current: { attributes: { channel: "progress_next_move" } } } } }), error => error.name === "ToolAccessBoundaryError");
  }
  const details = await actualDescriptors[0].callback(snapshot.tools[0], actualTools[0].inputSchema.parse({ kind: "child" }), webContext);
  assert.equal(details.asked, true);
  assert.equal(details.kind, "child");
  const questions = [{ header: "Child", question: "Which child?", options: [{ label: "Finn" }, { label: "Maya" }] }];
  const choice = await actualDescriptors[1].callback(snapshot.tools[1], actualTools[1].inputSchema.parse({ questions }), webContext);
  assert.equal(choice.asked, true);
  assert.equal(choice.questions[0].options[0].label, "Finn");
}
`);
  const env = { ...process.env, TSX_TSCONFIG_PATH: config };
  const snapshot = path.join(temporary, "snapshot.json");
  for (const mode of ["capture", "replay"]) {
    await execute(process.execPath, ["--import", "tsx", probe, mode, snapshot],
      { cwd: root, env, timeout: 15_000, maxBuffer: 1024 * 1024 });
  }
  const receipt = {
    checkedAt: new Date().toISOString(), candidateVersion: metadata.version, success: true,
    checks: ["actual Eve compiler transforms wrapper before execution", "actual durable descriptor", "JSON-only policy", "fresh-process execution", "snapshotted access denial", "snapshotted deadline and retry policy", "five web tools and seven restricted-task tools resolve", "all twelve replay callbacks preserve restricted access", "two actual card tools execute after process replacement"],
    limitations: "Actual Eve callback compiler and API, twelve source Homa tools, and synthetic policy control in separate processes. No full compiled runtime, paid call, database, hosted build, or app latency proof.",
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
