import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [packageDirectory, receiptPath] = process.argv.slice(2);
assert.ok(packageDirectory && receiptPath,
  "Usage: node scripts/eve-empty-delivery-harness-probe.mjs <eve-package> <receipt.json>");
const root = resolve(packageDirectory);
const metadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
assert.equal(metadata.name, "eve");
assert.equal(metadata.version, "0.54.3", "Review harness fixtures before using another Eve version");
const { createToolLoopHarness } = await import(pathToFileURL(resolve(root, "dist/src/harness/tool-loop.js")).href);
const sentinel = "<eve-empty-delivery/>";
const answer = "Synthetic answer.";
const parent = { role: "user", kind: "user", content: "Synthetic parent request." };
const actionHistory = [parent, {
  role: "assistant", content: [{ type: "tool-call", toolCallId: "synthetic-action", toolName: "synthetic_card", input: {} }],
}, {
  role: "tool", content: [{ type: "tool-result", toolCallId: "synthetic-action", toolName: "synthetic_card", output: { type: "json", value: { shown: true } } }],
}];
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const originalFetch = globalThis.fetch;
const networkAttempts = [];
globalThis.fetch = async () => {
  networkAttempts.push(true);
  throw new Error("Network disabled in offline empty-delivery probe");
};
const deadline = setTimeout(() => { console.error("Empty-delivery probe exceeded 20 seconds"); process.exit(1); }, 20_000);
const checks = [];
try {
  for (const streaming of [false, true]) {
    for (const scenario of ["fresh", "normal", "prior-action", "current-action", "repeated-empty"]) {
      let calls = 0;
      const prompts = [];
      const events = [];
      const nextText = (options) => {
        calls++;
        assert.ok(calls <= 2, "Empty delivery must not loop indefinitely");
        prompts.push(options.prompt);
        return scenario === "normal" || (calls === 2 && scenario !== "repeated-empty") ? answer : sentinel;
      };
      const model = {
        specificationVersion: "v4", provider: "synthetic", modelId: "synthetic-empty", supportedUrls: {},
        async doGenerate(options) {
          assert.equal(streaming, false);
          return { content: [{ type: "text", text: nextText(options) }],
            finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] };
        },
        async doStream(options) {
          assert.equal(streaming, true);
          const text = nextText(options);
          return { stream: new ReadableStream({ start(controller) {
            for (const part of [
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "synthetic-text" },
              { type: "text-delta", id: "synthetic-text", delta: text },
              { type: "text-end", id: "synthetic-text" },
              { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
            ]) controller.enqueue(part);
            controller.close();
          } }) };
        },
      };
      const run = createToolLoopHarness({
        mode: "conversation", tools: new Map(), resolveModel: async () => model,
        ...(streaming ? { handleEvent: async (event) => { events.push(event); } } : {}),
      });
      const session = {
        sessionId: "synthetic-empty", continuationToken: "synthetic-token", state: {},
        history: scenario.includes("action") ? structuredClone(actionHistory) : [],
        agent: { system: "Synthetic test.", tools: [], modelReference: { kind: "gateway", id: "synthetic/empty" } },
        compaction: { recentWindowSize: 10, threshold: 100000 },
      };
      let result;
      let error;
      try {
        result = await run(session, scenario === "current-action" ? undefined : { message: "Synthetic new parent request." });
      } catch (caught) { error = caught; }
      try {
        const expectedCalls = ["normal", "current-action"].includes(scenario) ? 1 : 2;
        assert.equal(calls, expectedCalls);
        if (scenario === "repeated-empty") {
          if (streaming) {
            const failures = events.filter(event => event.type === "turn.failed");
            assert.equal(failures.length, 1);
            assert.equal(failures[0].data.code, "MODEL_CALL_FAILED");
            assert.match(failures[0].data.message, /The model did not return a response/);
            assert.equal(result.settledTurn.isError, true);
            assert.equal(result.session.sessionId, session.sessionId);
          } else assert.equal(error?.name, "EmptyModelResponseError");
        } else {
          assert.equal(error, undefined);
          assert.equal(result.next, null);
          assert.equal(result.session.sessionId, session.sessionId);
          const historyText = JSON.stringify(result.session.history);
          if (scenario !== "current-action") {
            assert.ok(historyText.includes(answer), "Recovered answer must be retained");
            if (streaming) assert.equal(events.filter(event => event.type === "message.completed" && event.data.message === answer).length, 1);
          } else assert.ok(!historyText.includes(sentinel), "Action-backed sentinel must not enter durable history");
          assert.ok(!events.some(event => event.type === "turn.failed"));
        }
        if (calls === 2) {
          assert.match(JSON.stringify(prompts[1]), /Your previous reply was empty and was not delivered/);
          assert.match(JSON.stringify(prompts[1]), /do not re-run tools/);
        }
        checks.push({ mode: streaming ? "stream" : "generate", scenario, passed: true, modelCalls: calls });
      } catch (failure) {
        checks.push({ mode: streaming ? "stream" : "generate", scenario, passed: false, modelCalls: calls,
          failure: String(failure), harnessError: error ? String(error) : undefined });
      }
    }
  }
} finally {
  globalThis.fetch = originalFetch;
  clearTimeout(deadline);
}
assert.deepEqual(networkAttempts, []);
const receipt = {
  checkedAt: new Date().toISOString(), version: metadata.version,
  passed: checks.every(check => check.passed), checks, networkRequests: networkAttempts.length,
  limitations: "Actual Eve harness and AI SDK with a synthetic model. No provider, hosted server, database, or app latency measurement.",
};
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.passed) process.exitCode = 1;
