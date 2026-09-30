import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import ts from "typescript";
import { buildLiveSession } from "./live-session";

test("Live startup pins Gleam and client delegation without Realtime-only settings", () => {
  const session = buildLiveSession("Signed-in parent: Morgan");
  assert.equal(session.model, "gpt-live-1");
  assert.deepEqual(session.audio, { output: { voice: "gleam" } });
  assert.deepEqual(session.delegation, { type: "client" });
  assert.equal(session.store, false);
  assert.match(session.instructions, /You are Homa/);
  assert.match(session.instructions, /Signed-in parent: Morgan/);
  assert.doesNotMatch(JSON.stringify(session), /semantic_vad|interrupt_response|gpt-realtime-whisper/);
});

function fixture(options: { authenticated?: boolean; walled?: boolean; included?: boolean; limited?: boolean; user?: string; family?: string; providerFailure?: boolean; environment?: string; origin?: string; app2?: boolean } = {}) {
  const calls: { url: string; body: unknown }[] = [];
  const dependencies: Record<string, unknown> = {
    "node:crypto": crypto,
    "../../../../../lib/api-auth": { resolveApiFamily: async () => options.authenticated === false ? null : ({ familyId: options.family ?? "family-a", userId: options.user ?? "adult-a" }) },
    "../../../../../lib/billing/channel-access": { familyHasChannel: async () => options.included !== false },
    "../../../../../lib/billing/wall": { familyWallCheckout: async () => options.walled ? {} : null },
    "../../../../../lib/family-context": { loadFamilyContextPinned: async () => ({ members: [] }), renderFamilyContext: () => "" },
    "../../../../../lib/map/events": { emitMapEvent: async () => {} },
    "../../../../../lib/map/ratelimit": { rateLimited: () => !!options.limited },
    "../../../../../lib/voice/live-session": { buildLiveSession },
    "../../../../../lib/voice/realtime-session": { voiceSpeakerName: () => null },
  };
  const code = ts.transpileModule(readFileSync(new URL("../../app/api/voice/live/session/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { POST?: (request: Request) => Promise<Response>; DELETE?: (request: Request) => Promise<Response> } = {};
  runInNewContext(code, { exports, Response, Buffer, AbortSignal, URL, process: { env: { OPENAI_API_KEY: "fixture-key", NODE_ENV: options.environment ?? "production" } }, console: { error() {} },
    require: (name: string) => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; },
    fetch: async (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith("hangup")) return new Response(null, { status: 200 });
      return Response.json(options.providerFailure ? { error: { code: "invalid_model" } } : { session: { id: "live-fixture" }, transport: { sdp: "fixture-answer" } }, { status: options.providerFailure ? 400 : 200 });
    },
  });
  const request = (method: "POST" | "DELETE", body: unknown) => exports[method]!(new Request(`${options.origin ?? "https://homa.test"}/api/voice/live/session`, { method, headers: { "Content-Type": "application/json", ...(options.app2 ? { "x-homa-dev-surface": "app2" } : {}) }, body: JSON.stringify(body) }));
  return { request, calls };
}

test("unauthenticated, walled, excluded and limited callers never create a paid session", async () => {
  for (const [options, status] of [[{ authenticated: false }, 401], [{ walled: true }, 403], [{ included: false }, 403], [{ limited: true }, 429]] as const) {
    const f = fixture(options); assert.equal((await f.request("POST", { sdp: "v=0\r\n" })).status, status); assert.equal(f.calls.length, 0);
  }
});

test("local app2 admits an authenticated unpaid caller without changing auth, limits or shutdown ownership", async () => {
  const local = { environment: "development", origin: "http://127.0.0.1:3002", app2: true, walled: true, included: false };
  const f = fixture(local);
  const opened = await f.request("POST", { sdp: "v=0" });
  assert.equal(opened.status, 200);
  const handle = await opened.json();
  assert.equal((await f.request("DELETE", handle)).status, 200);
  const other = fixture({ ...local, user: "another-adult" });
  assert.equal((await other.request("DELETE", handle)).status, 403);
  for (const [override, status] of [[{ authenticated: false }, 401], [{ limited: true }, 429]] as const) {
    const denied = fixture({ ...local, ...override });
    assert.equal((await denied.request("POST", { sdp: "v=0" })).status, status);
    assert.equal(denied.calls.length, 0);
  }
});

test("app2 billing exception cannot be enabled in production or ordinary voice requests", async () => {
  for (const override of [
    { environment: "production" }, { environment: "test" },
    { origin: "https://thankshoma.com" }, { app2: false },
  ]) {
    for (const billing of [{ walled: true }, { included: false }]) {
      const f = fixture({ environment: "development", origin: "http://127.0.0.1:3002", app2: true, ...override, ...billing });
      assert.equal((await f.request("POST", { sdp: "v=0" })).status, 403);
      assert.equal(f.calls.length, 0);
    }
  }
});

test("the server pins config and returns no provider credential", async () => {
  const f = fixture();
  const response = await f.request("POST", { sdp: "v=0\r\n", model: "attacker", voice: "attacker", familyId: "attacker" });
  const body = await response.json();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.sdp, "fixture-answer");
  assert.doesNotMatch(JSON.stringify(body), /fixture-key/);
  const payload = f.calls[0].body as { session: { model: string; audio: { output: { voice: string } } } };
  assert.equal(payload.session.model, "gpt-live-1"); assert.equal(payload.session.audio.output.voice, "gleam");
  assert.equal((await f.request("DELETE", body)).status, 200);
  assert.equal(f.calls[1].url, "https://api.openai.com/v1/live/sessions/live-fixture/hangup");
});

test("shutdown handle cannot cross adult, family or session boundaries", async () => {
  const f = fixture(); const handle = await (await f.request("POST", { sdp: "v=0" })).json();
  for (const options of [{ user: "adult-b" }, { family: "family-b" }]) {
    const other = fixture(options); assert.equal((await other.request("DELETE", handle)).status, 403); assert.equal(other.calls.length, 0);
  }
  assert.equal((await f.request("DELETE", { ...handle, sessionId: "someone-else" })).status, 403);
});

test("bad offers and provider failures fail closed without retries", async () => {
  const f = fixture();
  for (const body of [null, {}, { sdp: "bad" }, { sdp: "v=0" + "x".repeat(64000) }]) assert.equal((await f.request("POST", body)).status, 400);
  assert.equal(f.calls.length, 0);
  const bad = fixture({ providerFailure: true }); assert.equal((await bad.request("POST", { sdp: "v=0" })).status, 502); assert.equal(bad.calls.length, 1);
});
