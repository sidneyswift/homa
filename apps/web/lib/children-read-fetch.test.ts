import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { createClient } from "@supabase/supabase-js";
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import ts from "typescript";

import { createBoundedChildrenReadFetch } from "./children-read-fetch";

const ORIGIN = "https://homa-children.test";
const FAMILY = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";
const CHILD = "33333333-3333-4333-8333-333333333333";
const TOKEN = "private-synthetic-jwt";
const SELECT = "id, family_id, name, birth_month, profile, avatar_url";
const ok = () => Response.json([{ id: CHILD, family_id: FAMILY, name: "Synthetic child", birth_month: "2018-01-01", profile: {}, avatar_url: null }]);
type Call = { input: RequestInfo | URL; init?: RequestInit; number: number };
function setup(respond: (call: Call) => Response | Promise<Response>, budgets = { attemptMs: 20, totalMs: 70 }, signal?: AbortSignal) {
  const calls: Call[] = [];
  const fetcher: typeof fetch = async (input, init) => { const call = { input, init, number: calls.length + 1 }; calls.push(call); return respond(call); };
  const bounded = createBoundedChildrenReadFetch(ORIGIN, FAMILY, { fetch: fetcher, ...budgets, signal });
  const client = createClient(ORIGIN, "synthetic-key", { global: { fetch: bounded, headers: { Authorization: `Bearer ${TOKEN}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const read = () => client.from("children").select(SELECT).eq("family_id", FAMILY).order("created_at", { ascending: true }).retry(false);
  return { calls, bounded, read };
}
function stalled(call: Call, settle?: () => void): Promise<Response> {
  assert.ok(call.init?.signal);
  return new Promise((_, reject) => call.init!.signal!.addEventListener("abort", () => { settle?.(); reject(new DOMException("private detail", "AbortError")); }, { once: true }));
}
function expectedUrl() {
  return `${ORIGIN}/rest/v1/children?${new URLSearchParams({ select: SELECT.replaceAll(" ", ""), family_id: `eq.${FAMILY}`, order: "created_at.asc" })}`;
}

test("real SDK healthy children GET preserves rows, family scope, order and caller authorization", async () => {
  const f = setup(() => ok());
  const result = await f.read();
  assert.equal(result.error, null); assert.equal(result.data?.[0].id, CHILD);
  assert.equal(f.calls.length, 1); assert.equal(String(f.calls[0].input), expectedUrl());
  assert.equal(new Headers(f.calls[0].init?.headers).get("authorization"), `Bearer ${TOKEN}`);
});

test("real SDK recovers a gateway or network failure with the same exact RLS request", async () => {
  for (const kind of ["gateway", "network"]) {
    const f = setup(call => { if (call.number > 1) return ok(); if (kind === "network") throw new TypeError("private network detail"); return new Response("Gateway Timeout", { status: 504 }); });
    assert.equal((await f.read()).data?.[0].id, CHILD); assert.equal(f.calls.length, 2);
    assert.equal(String(f.calls[0].input), String(f.calls[1].input));
    assert.deepEqual(new Headers(f.calls[0].init?.headers), new Headers(f.calls[1].init?.headers));
  }
});

test("attempt abort settles fetch before any replacement GET", async () => {
  let settled = false;
  const f = setup(call => { if (call.number === 1) return stalled(call, () => { settled = true; }); assert.equal(settled, true); return ok(); });
  assert.equal((await f.read()).error, null); assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].init?.signal?.aborted, true);
});

test("body timeout cancels and joins the reader before retry", async () => {
  let cancelled = false; let settled = false;
  const f = setup(call => {
    if (call.number === 1) return new Response(new ReadableStream({ async cancel() { cancelled = true; await sleep(5); settled = true; } }), { status: 200 });
    assert.equal(cancelled, true); assert.equal(settled, true); return ok();
  });
  assert.equal((await f.read()).data?.[0].id, CHILD); assert.equal(f.calls.length, 2);
});

test("two stalls exhaust without SDK retries, empty success or late extra reads", async () => {
  const f = setup(call => stalled(call), { attemptMs: 15, totalMs: 40 });
  const before = performance.now(); const result = await f.read();
  assert.equal(result.data, null); assert.equal(result.status, 503); assert.ok(result.error);
  assert.equal(f.calls.length, 2); assert.ok(performance.now() - before < 250);
  await sleep(30); assert.equal(f.calls.length, 2); assert.ok(f.calls.every(call => call.init?.signal?.aborted));
});

test("absolute deadline stops a non-settling fetch or body cancellation without overlap", async () => {
  for (const phase of ["fetch", "body"]) {
    let release!: () => void;
    const f = setup(() => phase === "fetch"
      ? new Promise<Response>(resolve => { release = () => resolve(ok()); })
      : new Response(new ReadableStream({ cancel: () => new Promise<void>(resolve => { release = resolve; }) })), { attemptMs: 10, totalMs: 30 });
    const result = await f.read(); assert.equal(result.data, null); assert.equal(result.status, 503);
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].init?.signal?.aborted, true);
    release(); await sleep(10); assert.equal(f.calls.length, 1);
  }
});

test("received auth denials and coded PostgREST/SQL failures never retry", async () => {
  for (const [status, code] of [[401, "PGRST301"], [403, "42501"], [400, "42703"], [503, "PGRST000"], [504, "57014"]] as const) {
    const f = setup(() => Response.json({ code, message: "Synthetic denied query", details: null, hint: null }, { status }));
    const result = await f.read(); assert.equal(result.status, status); assert.equal(result.error?.code, code);
    assert.equal(result.data, null); assert.equal(f.calls.length, 1);
  }
  for (const status of [401, 403]) {
    const f = setup(() => new Response(new ReadableStream({ cancel() {} }), { status }));
    assert.equal((await f.read()).status, status); assert.equal(f.calls.length, 1);
  }
});

test("Retry-After, rate limiting and other statuses preserve their response without retry", async () => {
  for (const [status, retryAfter] of [[429, null], [500, null], [503, "1"]] as const) {
    const f = setup(() => Response.json({ message: "Synthetic unavailable" }, { status, headers: retryAfter ? { "retry-after": retryAfter } : {} }));
    const result = await f.read(); assert.equal(result.status, status); assert.equal(result.data, null); assert.equal(f.calls.length, 1);
  }
});

test("caller cancellation before or during the request stops without replacement", async () => {
  const before = new AbortController(); before.abort();
  const f = setup(() => assert.fail("No fetch allowed"), undefined, before.signal);
  assert.equal((await f.read()).status, 503); assert.equal(f.calls.length, 0);
  const during = new AbortController();
  const g = setup(call => { queueMicrotask(() => during.abort()); return stalled(call); }, undefined, during.signal);
  assert.equal((await g.read()).status, 503); assert.equal(g.calls.length, 1); assert.equal(g.calls[0].init?.signal?.aborted, true);
});

test("every other endpoint, family, projection, query variation and method passes through unchanged", async () => {
  const original = new Response("original");
  for (const [url, method] of [[expectedUrl(), "POST"], [expectedUrl(), "DELETE"], [expectedUrl() + "&limit=1", "GET"],
    [expectedUrl().replace(FAMILY, CHILD), "GET"], [expectedUrl().replace("created_at.asc", "created_at.desc"), "GET"],
    [`${ORIGIN}/rest/v1/children?select=id`, "GET"], [expectedUrl().replace(ORIGIN, "https://other.invalid"), "GET"],
    [`${ORIGIN}/auth/v1/user`, "GET"], [`${ORIGIN}/auth/v1/token?grant_type=refresh_token`, "POST"],
    ["https://homa.invalid/eve/v1/session", "POST"]]) {
    const input = new Request(url, { method }); const init = { headers: { "x-original": "unchanged" } };
    const f = setup(call => { assert.equal(call.input, input); assert.equal(call.init, init); return original; });
    assert.equal(await f.bounded(input, init), original); assert.equal(f.calls.length, 1);
  }
});

// Run the real family/server/helper modules, replacing only Next's request
// cookie store. The SDK and query builder are real, with a controlled fetch.
function loadFamily(fetcher: typeof fetch) {
  const lib = path.dirname(fileURLToPath(import.meta.url));
  const modules = new Map<string, { exports: Record<string, unknown> }>();
  const session = { access_token: TOKEN, refresh_token: "private-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: USER, aud: "authenticated" } };
  const cookies = [{ name: "sb-homa-children-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` }];
  function load(file: string): Record<string, unknown> {
    if (modules.has(file)) return modules.get(file)!.exports;
    const source = readFileSync(file, "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const entry = { exports: {} }; modules.set(file, entry);
    const require = (name: string) => {
      if (name === "@supabase/ssr") return { createServerClient, parseCookieHeader };
      if (name === "next/headers") return { cookies: async () => ({ getAll: () => cookies, set() {} }) };
      assert.ok(name.startsWith("."), `Unexpected dependency ${name}`);
      const resolved = path.resolve(path.dirname(file), `${name}.ts`);
      assert.ok(resolved.startsWith(lib + path.sep));
      return load(resolved);
    };
    const context = vm.createContext({ module: entry, exports: entry.exports, require, fetch: fetcher, URL, URLSearchParams, Request, Response, Headers,
      AbortController, AbortSignal, TextDecoder, Uint8Array, performance, setTimeout, clearTimeout, TypeError,
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: ORIGIN, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-key" } } });
    new vm.Script(code, { filename: file }).runInContext(context);
    return entry.exports;
  }
  return load(path.join(lib, "family.ts")) as { getMyChildren(familyId: string): Promise<{ id: string }[]> };
}

test("actual getMyChildren opts only its SSR caller query into recovery and still throws on denial/exhaustion", async () => {
  for (const outcome of ["recover", "deny", "exhaust", "empty", "malformed"]) {
    let calls = 0;
    const family = loadFamily(async (input, init) => {
      calls++; assert.equal(String(input), expectedUrl());
      assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${TOKEN}`);
      if (outcome === "deny") return Response.json({ code: "42501", message: "denied" }, { status: 403 });
      if (outcome === "empty") return Response.json([]);
      if (outcome === "malformed") return new Response("invalid JSON", { status: 200 });
      if (calls === 1 || outcome === "exhaust") return new Response("Gateway Timeout", { status: 504 });
      return ok();
    });
    if (outcome === "recover") assert.equal((await family.getMyChildren(FAMILY))[0].id, CHILD);
    else if (outcome === "empty") assert.equal((await family.getMyChildren(FAMILY)).length, 0);
    else await assert.rejects(family.getMyChildren(FAMILY), /children read failed/);
    assert.equal(calls, outcome === "recover" || outcome === "exhaust" ? 2 : 1);
  }
});
