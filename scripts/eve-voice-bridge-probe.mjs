import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [packageDirectory, receiptPath] = process.argv.slice(2);
assert.ok(packageDirectory && receiptPath, "Usage: node scripts/eve-voice-bridge-probe.mjs <eve-package> <receipt.json>");
const workspace = fileURLToPath(new URL("../", import.meta.url));
const sdk = resolve(packageDirectory);
const metadata = JSON.parse(await readFile(resolve(sdk, "package.json"), "utf8"));
assert.equal(metadata.name, "eve");
assert.ok(["0.19.0", "0.54.3"].includes(metadata.version), "Review the protocol fixtures before probing another Eve version.");
const handles = metadata.version === "0.54.3";
const fixtureRequire = createRequire(resolve(workspace, "package.json"));
const { build } = createRequire(fixtureRequire.resolve("tsx/package.json"))("esbuild");
const scratch = await mkdtemp(resolve(tmpdir(), "homa-voice-probe-"));
const originalFetch = globalThis.fetch;
const originalSecret = process.env.CRON_SECRET;
const requests = [];
const violations = [];
const sessionId = "synthetic-voice-session";
const sourceMessageId = "11111111-1111-4111-8111-111111111111";
let expectedMessageId = sourceMessageId;
const message = "Synthetic voice question";
const sourceContext = "Synthetic spoken context";
const activeObjectContext = "Synthetic active worksheet";
let postCount = 0;
let failNext = false;
let atIndex = 0;
const deadline = setTimeout(() => {
  console.error("Voice bridge probe did not finish within 15 seconds.");
  process.exit(1);
}, 15_000);

try {
  await build({
    stdin: { contents: 'export * from "./apps/web/lib/voice/homa-bridge.ts"; export { trustedVoiceBridgeRequest, voiceBridgeMessageMatches } from "./apps/web/lib/voice/voice-bridge-auth.ts";', resolveDir: workspace },
    bundle: true, platform: "node", format: "esm", outfile: resolve(scratch, "bridge.mjs"),
    alias: { "eve/client": resolve(sdk, "dist/src/client/index.js") },
  });
  const { askHomaFromVoice, trustedVoiceBridgeRequest, voiceBridgeMessageMatches } = await import(pathToFileURL(resolve(scratch, "bridge.mjs")).href);
  process.env.CRON_SECRET = "synthetic-voice-probe-secret";
  globalThis.fetch = async (url, init = {}) => {
    try {
      const parsed = new URL(String(url));
      assert.equal(parsed.origin, "https://homa-voice.test");
      assert.equal(init.redirect, "error");
      const headers = new Headers(init.headers);
      assert.equal(headers.get("authorization"), "Bearer synthetic-fixture");
      assert.equal(headers.get("x-homa-channel"), "mobile");
      assert.equal(headers.get("x-homa-message-modality"), "voice");
      const trusted = trustedVoiceBridgeRequest(new Request(url, { headers }), { accessToken: "synthetic-fixture" });
      assert.equal(trusted?.messageId, expectedMessageId);
      assert.equal(trusted?.activeObjectContext, activeObjectContext);
      assert.equal(voiceBridgeMessageMatches(message, trusted.messageSha256), true);
      assert.ok(init.signal);
      const method = init.method ?? "GET";
      requests.push({ method, path: parsed.pathname });
      if (method === "POST") {
        postCount++;
        assert.equal(parsed.pathname, postCount === 1 ? "/eve/v1/session" : `/eve/v1/session/${sessionId}`);
        const body = JSON.parse(init.body);
        assert.equal(body.message, message);
        assert.equal(body.clientContext, sourceContext);
        assert.equal(Object.hasOwn(body, "continuationToken"), !handles && postCount > 1);
        if (failNext) return new Response("Synthetic unavailable", { status: 500 });
        return Response.json({ sessionId, deliveryId: `delivery-${postCount}`,
          ...(handles ? {} : { continuationToken: "synthetic-continuation" }),
        }, { status: handles || postCount === 1 ? 202 : 200 });
      }
      assert.equal(method, "GET");
      assert.equal(parsed.pathname, `/eve/v1/session/${sessionId}/stream`);
      assert.equal(Number(parsed.searchParams.get("startIndex") ?? 0), atIndex);
      const turnId = `turn-${postCount}`;
      const text = `Synthetic reply ${postCount}`;
      const events = [
        { type: "turn.started", data: { sequence: atIndex, turnId } },
        { type: "action.result", data: { sequence: atIndex + 1, turnId, stepIndex: 0, status: "completed", result: { kind: "tool-result", callId: `call-${postCount}`, toolName: "open_planner", output: { opened: true } } } },
        { type: "message.appended", data: { sequence: atIndex + 2, turnId, stepIndex: 0, messageDelta: text, ...(handles ? {} : { messageSoFar: text }) } },
        { type: "message.completed", data: { sequence: atIndex + 3, turnId, stepIndex: 0, message: text, finishReason: "stop" } },
        { type: "session.waiting", data: { wait: "next-user-message" } },
      ].map((event, index) => ({ ...event, meta: { id: `${turnId}-${index}`, at: new Date().toISOString(), deliveryIds: [`delivery-${postCount}`] } }));
      atIndex += events.length;
      return new Response(events.map(event => JSON.stringify(event)).join("\n") + "\n", { headers: {
        "content-type": "application/x-ndjson", "x-eve-stream-version": handles ? "25" : "16",
      } });
    } catch (error) { violations.push(String(error)); throw error; }
  };
  const input = { host: "https://homa-voice.test", accessToken: "synthetic-fixture", message,
    sourceMessageId, sourceContext, activeObjectContext };
  const first = await askHomaFromVoice(input);
  assert.equal(first.ok, true);
  assert.equal(first.spokenReply, "Synthetic reply 1");
  assert.equal(first.effects[0]?.toolName, "open_planner");
  assert.deepEqual(first.effects[0]?.output, { opened: true });
  assert.equal(first.sessionState?.sessionId, sessionId);
  assert.equal(first.sessionState?.streamIndex, 5);
  expectedMessageId = "22222222-2222-4222-8222-222222222222";
  const second = await askHomaFromVoice({ ...input, sourceMessageId: expectedMessageId, sessionState: first.sessionState });
  assert.equal(second.ok, true);
  assert.equal(second.spokenReply, "Synthetic reply 2");
  assert.equal(second.sessionState?.sessionId, sessionId);
  assert.equal(second.sessionState?.streamIndex, 10);
  failNext = true;
  expectedMessageId = "33333333-3333-4333-8333-333333333333";
  const failed = await askHomaFromVoice({ ...input, sourceMessageId: expectedMessageId, sessionState: second.sessionState });
  assert.equal(failed.ok, false);
  assert.deepEqual(failed.effects, []);
  assert.equal(postCount, 3);
  assert.deepEqual(violations, []);
  assert.equal(requests.filter(request => request.path === "/eve/v1/session").length, 1);
  await writeFile(resolve(receiptPath), JSON.stringify({
    checkedAt: new Date().toISOString(), sdk: metadata.version,
    checks: ["actual default voice runner creates one session", "signed voice context survives each request", "spoken text and authored effect are preserved", "follow-up reuses the session and advances its cursor", "failure does not resend or create a replacement"],
    requests, networkCalls: 0, modelCalls: 0, databaseWrites: 0,
    limitations: "Real Homa default voice runner and SDK with synthetic fetch responses. No audio device, speech model, server runtime, deployment or latency measurement.",
  }, null, 2) + "\n");
  console.log(`Voice bridge checks passed on Eve ${metadata.version}; no network or model calls.`);
} finally {
  globalThis.fetch = originalFetch;
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  clearTimeout(deadline);
  await rm(scratch, { recursive: true, force: true });
}
