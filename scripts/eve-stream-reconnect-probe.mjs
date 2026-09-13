import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [packageDirectory, receiptPath] = process.argv.slice(2);
assert.ok(packageDirectory && receiptPath,
  "Usage: node scripts/eve-stream-reconnect-probe.mjs <eve-package> <receipt.json>");
const root = resolve(packageDirectory);
const metadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
assert.equal(metadata.name, "eve");
assert.equal(metadata.version, "0.54.3", "Review reconnect fixtures before testing another Eve version");
const { Client } = await import(pathToFileURL(resolve(root, "dist/src/client/index.js")).href);
const host = "https://homa-reconnect.test";
const sessionId = "synthetic-reconnect-session";
const encoder = new TextEncoder();
const originalFetch = globalThis.fetch;
const checks = [];
const deadline = setTimeout(() => {
  console.error("Offline reconnect probe exceeded 15 seconds");
  process.exit(1);
}, 15_000);
const events = [
  { type: "turn.started", data: { turnId: "turn-one", sequence: 0 } },
  { type: "message.appended", data: { turnId: "turn-one", sequence: 1, stepIndex: 0, messageDelta: "Synthetic answer." } },
  { type: "message.completed", data: { turnId: "turn-one", sequence: 2, stepIndex: 0, message: "Synthetic answer.", finishReason: "stop" } },
  { type: "session.waiting", data: { wait: "next-user-message" } },
].map((event, index) => ({ ...event, meta: { id: `synthetic-${index}`, at: "2026-09-13T00:00:00.000Z" } }));
const headers = { "content-type": "application/x-ndjson", "x-eve-stream-version": "25" };
const serialize = (items) => items.map(event => JSON.stringify(event)).join("\n") + "\n";
const cases = [
  { name: "Safari initial Load failed", error: new TypeError("Load failed"), recover: true },
  { name: "Chromium initial Failed to fetch", error: new TypeError("Failed to fetch"), recover: true },
  { name: "Node initial fetch failed", error: new TypeError("fetch failed"), recover: true },
  { name: "partial body resumes at cursor", partial: true, recover: true },
  { name: "malformed JSON fails without retry", malformed: true },
  { name: "programming TypeError fails without retry", error: new TypeError("Cannot read properties of undefined") },
  { name: "401 fails without retry", unauthorized: true },
  { name: "repeated Load failed respects attempt limit", error: new TypeError("Load failed"), exhaust: true },
];
try {
  for (const scenario of cases) {
    const requests = [];
    const transportViolations = [];
    let gets = 0;
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      requests.push({ method: request.method, url: request.url });
      try {
        assert.equal(request.headers.get("authorization"), "Bearer synthetic-reconnect");
        assert.equal(init.redirect, "error");
        assert.ok(init.signal instanceof AbortSignal);
        if (request.method === "POST") {
          assert.equal(request.url, `${host}/eve/v1/session`);
          assert.deepEqual(await request.json(), { message: "Synthetic prompt" });
          assert.equal(requests.length, 1, "Reconnection must not resubmit the message");
          return Response.json({ sessionId }, { status: 202 });
        }
        assert.equal(request.method, "GET");
        gets++;
        const suffix = scenario.partial && gets > 1 ? "?startIndex=2" : "";
        assert.equal(request.url, `${host}/eve/v1/session/${sessionId}/stream${suffix}`);
        assert.ok(gets <= 3, "Stream-open retry count exceeded policy");
        if (scenario.error && (gets === 1 || scenario.exhaust)) throw scenario.error;
        if (scenario.unauthorized) return new Response("Synthetic access denied", { status: 401 });
        if (scenario.malformed) return new Response("{invalid-json}\n", { headers });
        if (scenario.partial && gets === 1) {
          let delivered = false;
          return new Response(new ReadableStream({
            pull(controller) {
              if (!delivered) {
                delivered = true;
                controller.enqueue(encoder.encode(serialize(events.slice(0, 2))));
              } else controller.error(new TypeError("Load failed"));
            },
          }), { headers });
        }
        return new Response(serialize(scenario.partial ? events.slice(2) : events), { headers });
      } catch (error) {
        if (error !== scenario.error) transportViolations.push(String(error));
        throw error;
      }
    };
    let error;
    const observed = [];
    try {
      const client = new Client({ host, auth: { bearer: "synthetic-reconnect" }, redirect: "error" });
      const created = await client.sessions.create({
        message: "Synthetic prompt", signal: new AbortController().signal,
        streamReconnectPolicy: {
          streamOpenReconnectPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
          streamIdleReconnectPolicy: { baseDelayMs: 1, maxDelayMs: 1 },
        },
      });
      for await (const event of created.response) observed.push(event);
      if (scenario.recover) assert.deepEqual(created.session.state, { sessionId, streamIndex: 4 });
    } catch (caught) { error = caught; }
    try {
      assert.deepEqual(transportViolations, []);
      assert.equal(requests.filter(request => request.method === "POST").length, 1);
      if (scenario.recover) {
        assert.equal(error, undefined);
        assert.equal(gets, 2);
        assert.equal(observed.filter(event => event.type === "message.appended")
          .map(event => event.data.messageDelta).join(""), "Synthetic answer.");
        assert.equal(observed.length, 4);
        assert.equal(observed.at(-1)?.type, "session.waiting");
      } else {
        assert.ok(error, "Expected a failed stream");
        assert.equal(gets, scenario.exhaust ? 3 : 1);
        if (scenario.error) assert.equal(error, scenario.error);
      }
      checks.push({ name: scenario.name, passed: true, postCount: 1, getCount: gets });
    } catch (failure) {
      checks.push({ name: scenario.name, passed: false, getCount: gets, failure: String(failure) });
    }
  }
} finally {
  globalThis.fetch = originalFetch;
  clearTimeout(deadline);
}
const receipt = {
  checkedAt: new Date().toISOString(), version: metadata.version,
  passed: checks.every(check => check.passed), checks,
  limitations: "Actual SDK client, synthetic HTTP only. No model, server, browser engine, or hosted latency measurement.",
};
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.passed) process.exitCode = 1;
