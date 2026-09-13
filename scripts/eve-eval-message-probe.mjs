import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { sendEvalMessage } from "../apps/web/lib/eval-send-message.ts";

// Exercise the selected SDK's actual eval context without running a model.
const [packageDirectory, receiptPath] = process.argv.slice(2);
assert.ok(packageDirectory && receiptPath,
  "Usage: node scripts/eve-eval-message-probe.mjs <eve-package> <receipt.json>");
const root = resolve(packageDirectory);
const metadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
assert.equal(metadata.name, "eve");
assert.ok(["0.19.0", "0.54.3"].includes(metadata.version), "Unreviewed Eve eval protocol");
const originalFetch = globalThis.fetch;
const networkAttempts = [];
globalThis.fetch = async () => {
  networkAttempts.push(true);
  throw new Error("Network disabled in offline eval-message probe");
};
try {
  const { createEvalContext } = await import(
    pathToFileURL(resolve(root, "dist/src/evals/context.js")).href
  );
  const { AssertionCollector } = await import(
    pathToFileURL(resolve(root, "dist/src/evals/assertions/collector.js")).href
  );
  const requests = [];
  const returnedTurn = { sessionId: "synthetic-eval-session", message: "Synthetic reply" };
  const failure = new Error("Synthetic send failure");
  const primary = {
    send(...args) {
      requests.push(args);
      if (requests.length === 4) return Promise.reject(failure);
      return Promise.resolve(returnedTurn);
    },
  };
  const { context } = createEvalContext({
    manager: { primary },
    collector: new AssertionCollector(),
    target: { name: "synthetic" },
    signal: new AbortController().signal,
    judge: undefined,
    log() {},
  });
  const payloads = [
    { message: "Revise this worksheet.", clientContext: { materialId: "synthetic-material", pageCount: 2 } },
    { message: "Synthetic voice transcript", headers: { "x-homa-message-modality": "voice" } },
    { message: "Synthetic onboarding response", headers: { "x-synthetic-mode": "onboarding" }, clientContext: "synthetic context" },
  ];
  for (const payload of payloads) {
    assert.equal(await sendEvalMessage(context, payload), returnedTurn);
    const actual = requests.at(-1);
    if (metadata.version === "0.19.0") {
      assert.deepEqual(actual, [payload]);
      assert.equal(actual[0], payload);
    } else {
      const { message, ...options } = payload;
      assert.deepEqual(actual, [message, options]);
      assert.equal(actual[1].headers, payload.headers);
      assert.equal(actual[1].clientContext, payload.clientContext);
    }
  }
  await assert.rejects(sendEvalMessage(context, payloads[0]), (error) => error === failure);
  assert.equal(requests.length, 4, "Failures must not retry or send a replacement turn");
  assert.deepEqual(networkAttempts, []);
  const receipt = {
    checkedAt: new Date().toISOString(), version: metadata.version,
    checks: ["material context", "voice headers", "onboarding headers and context", "turn identity", "failure without retry"],
    requestCount: requests.length, networkRequests: networkAttempts.length,
    limitations: "Actual SDK eval context with a synthetic session driver. No model, judge, server, or hosted latency test.",
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt));
} finally {
  globalThis.fetch = originalFetch;
}
