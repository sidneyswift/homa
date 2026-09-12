import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { test, type TestContext } from "node:test";

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { routeAuth } from "eve/channels/auth";

import { createBoundedAuthUserFetch } from "./auth-user-fetch";
import { resolveApiFamily } from "./api-auth";
import { readEveAuthentication } from "./eve-authentication";

const URL = "https://homa-auth.test";
const TOKEN = "private-synthetic-jwt";
const USER = "11111111-1111-4111-8111-111111111111";
const FAMILY = "22222222-2222-4222-8222-222222222222";
const ok = () => Response.json({ id: USER, aud: "authenticated", email: "private@example.invalid" });
type Call = { input: RequestInfo | URL; init?: RequestInit; number: number };

function setup(respond: (call: Call) => Response | Promise<Response>, budgets = { attemptMs: 20, totalMs: 65 }, signal?: AbortSignal) {
  const calls: Call[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const call = { input, init, number: calls.length + 1 }; calls.push(call);
    return respond(call);
  };
  const bounded = createBoundedAuthUserFetch(URL, { fetch: fetcher, ...budgets, signal });
  const client = createClient(URL, "synthetic-key", {
    global: { fetch: bounded, headers: { Authorization: `Bearer ${TOKEN}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { calls, client, bounded, fetcher };
}

function pendingUntilAbort(call: Call, settled?: () => void): Promise<Response> {
  assert.ok(call.init?.signal);
  return new Promise((_, reject) => {
    call.init!.signal!.addEventListener("abort", () => {
      settled?.(); reject(new DOMException("private transport detail", "AbortError"));
    }, { once: true });
  });
}

test("real SDK healthy bearer Auth reads once and preserves request JWT plus full user response", async () => {
  const f = setup(() => ok());
  const result = await readEveAuthentication(() => f.client.auth.getUser(TOKEN));
  assert.equal(result.data.user?.id, USER);
  assert.equal(result.data.user?.email, "private@example.invalid");
  assert.equal(f.calls.length, 1);
  assert.equal(String(f.calls[0].input), `${URL}/auth/v1/user`);
  assert.equal(f.calls[0].init?.method, "GET");
  assert.equal(new Headers(f.calls[0].init?.headers).get("authorization"), `Bearer ${TOKEN}`);
});

test("real SDK 504 and network recovery repeat only the user GET with identical authorization", async () => {
  for (const network of [false, true]) {
    const f = setup((call) => {
      if (call.number > 1) return ok();
      if (network) throw new TypeError("private network message");
      return new Response("private gateway body", { status: 504 });
    });
    const result = await readEveAuthentication(() => f.client.auth.getUser(TOKEN));
    assert.equal(result.data.user?.id, USER);
    assert.equal(f.calls.length, 2);
    assert.deepEqual(new Headers(f.calls[0].init?.headers), new Headers(f.calls[1].init?.headers));
  }
});

test("attempt timeout aborts and settles before the second GET starts", async () => {
  let settled = false;
  const f = setup((call) => {
    if (call.number === 1) return pendingUntilAbort(call, () => { settled = true; });
    assert.equal(settled, true);
    assert.equal(f.calls[0].init?.signal?.aborted, true);
    return ok();
  });
  assert.equal((await f.client.auth.getUser(TOKEN)).data.user?.id, USER);
  assert.equal(f.calls.length, 2);
});

test("body timeout actively cancels and settles the first reader before retry", async () => {
  let bodyCancelled = false;
  let cancellationSettled = false;
  const f = setup((call) => {
    if (call.number === 1) return new Response(new ReadableStream({
      async cancel() { bodyCancelled = true; await sleep(5); cancellationSettled = true; },
    }), { status: 200 });
    assert.equal(bodyCancelled, true);
    assert.equal(cancellationSettled, true);
    return ok();
  });
  assert.equal((await f.client.auth.getUser(TOKEN)).data.user?.id, USER);
  assert.equal(f.calls.length, 2);
});

test("two stalls and an absolute deadline both fail closed without further requests", async () => {
  for (const budgets of [{ attemptMs: 15, totalMs: 40 }, { attemptMs: 100, totalMs: 25 }]) {
    const f = setup((call) => pendingUntilAbort(call), budgets);
    const before = performance.now();
    const result = await f.client.auth.getUser(TOKEN);
    assert.equal(result.data.user, null);
    assert.equal(result.error?.status, 503);
    assert.ok(performance.now() - before < 250);
    assert.equal(f.calls.length, budgets.attemptMs > budgets.totalMs ? 1 : 2);
    assert.ok(f.calls.every((call) => call.init?.signal?.aborted));
    await sleep(30);
    assert.equal(f.calls.length, budgets.attemptMs > budgets.totalMs ? 1 : 2);
  }
});

test("a fetch ignoring cancellation cannot overlap another attempt or authorize from late success", async () => {
  let complete!: (response: Response) => void;
  const f = setup(() => new Promise((resolve) => { complete = resolve; }), { attemptMs: 10, totalMs: 30 });
  const result = await f.client.auth.getUser(TOKEN);
  assert.equal(result.data.user, null);
  assert.equal(result.error?.status, 503);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].init?.signal?.aborted, true);
  complete(ok());
  await sleep(10);
  assert.equal(f.calls.length, 1);
});

test("an unsettled body cancellation waits for total deadline without overlapping a retry", async () => {
  let release!: () => void;
  const f = setup(() => new Response(new ReadableStream({
    cancel: () => new Promise<void>((resolve) => { release = resolve; }),
  })), { attemptMs: 10, totalMs: 30 });
  const result = await f.client.auth.getUser(TOKEN);
  assert.equal(result.error?.status, 503);
  assert.equal(f.calls.length, 1);
  release(); await sleep(10);
  assert.equal(f.calls.length, 1);
});

test("401 and 403, including after one transient response, remain denials without another GET", async () => {
  for (const status of [401, 403, 404]) {
    for (const afterTransient of [false, true]) {
      const f = setup((call) => afterTransient && call.number === 1
        ? new Response("Gateway timeout", { status: 504 })
        : Response.json({ code: "bad_jwt", message: "denied" }, { status }));
      const result = await readEveAuthentication(() => f.client.auth.getUser(TOKEN));
      assert.equal(result.error?.status, status);
      assert.equal(result.data.user, null);
      assert.equal(f.calls.length, afterTransient ? 2 : 1);
    }
  }
});

test("a received 401/403 with stalled body stays a denial and is never retried", async () => {
  for (const status of [401, 403]) {
    const f = setup(() => new Response(new ReadableStream({ cancel() {} }), { status }));
    const result = await readEveAuthentication(() => f.client.auth.getUser(TOKEN));
    assert.equal(result.error?.status, status);
    assert.equal(f.calls.length, 1);
  }
});

test("rate limiting, Retry-After and unselected errors are not automatically retried", async () => {
  for (const [status, retryAfter] of [[429, null], [408, null], [500, null], [503, "1"], [504, "Fri, 12 Sep 2026 23:00:00 GMT"]] as const) {
    const f = setup(() => Response.json({ message: "unavailable" }, { status, headers: retryAfter ? { "Retry-After": retryAfter } : {} }));
    assert.equal((await f.client.auth.getUser(TOKEN)).data.user, null);
    assert.equal(f.calls.length, 1);
  }
});

test("cancellation before or during lookup starts no replacement and aborts the underlying request", async () => {
  const cancelled = new AbortController(); cancelled.abort();
  const before = setup(() => assert.fail("No request allowed"), undefined, cancelled.signal);
  assert.equal((await before.client.auth.getUser(TOKEN)).data.user, null);
  const controller = new AbortController();
  const during = setup((call) => { queueMicrotask(() => controller.abort()); return pendingUntilAbort(call); }, undefined, controller.signal);
  assert.equal((await during.client.auth.getUser(TOKEN)).data.user, null);
  assert.equal(during.calls.length, 1);
  assert.equal(during.calls[0].init?.signal?.aborted, true);
});

test("all other URLs, query variants and methods pass through untouched exactly once", async () => {
  const original = new Response("original");
  for (const [path, method] of [[`${URL}/auth/v1/user`, "PUT"], [`${URL}/auth/v1/user`, "POST"],
    [`${URL}/auth/v1/user`, "DELETE"], [`${URL}/auth/v1/user?x=1`, "GET"],
    ["https://other.invalid/auth/v1/user", "GET"], [`${URL}/auth/v1/token?grant_type=refresh_token`, "POST"],
    [`${URL}/rest/v1/family_members`, "GET"], ["https://homa.invalid/eve/v1/session", "POST"]]) {
    const input = new Request(path, { method });
    const init = { headers: { "x-original": "unchanged" } };
    const f = setup((call) => { assert.equal(call.input, input); assert.equal(call.init, init); return original; });
    assert.equal(await f.bounded(input, init), original);
    assert.equal(f.calls.length, 1);
  }
});

test("exact GET Request inputs retain native init signal precedence and all parent abort sources", async () => {
  const aborted = new AbortController(); aborted.abort();
  const input = new Request(`${URL}/auth/v1/user`, { signal: aborted.signal });
  for (const init of [undefined, { signal: undefined }, { signal: null }, { signal: new AbortController().signal }]) {
    const nativeAborted = new Request(input, init).signal.aborted;
    const f = setup(() => ok());
    const response = await f.bounded(input, init);
    assert.equal(response.status, nativeAborted ? 503 : 200);
    assert.equal(f.calls.length, nativeAborted ? 0 : 1);
    if (!nativeAborted) assert.equal(f.calls[0].input, input);
  }
  for (const source of ["input", "init", "options"]) {
    const parent = new AbortController();
    const request = new Request(`${URL}/auth/v1/user`, {
      signal: source === "input" ? parent.signal : source === "init" ? aborted.signal : undefined,
    });
    const init = source === "init" ? { signal: parent.signal } : undefined;
    const f = setup((call) => {
      queueMicrotask(() => parent.abort());
      return pendingUntilAbort(call);
    }, undefined, source === "options" ? parent.signal : undefined);
    assert.equal((await f.bounded(request, init)).status, 503);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].init?.signal?.aborted, true);
  }
  const optionsAborted = setup(() => assert.fail("Caller cancellation must survive init override"), undefined, aborted.signal);
  assert.equal((await optionsAborted.bounded(input, { signal: null })).status, 503);
});

test("init method override on an exact GET Request passes a non-GET through unchanged", async () => {
  const input = new Request(`${URL}/auth/v1/user`);
  const init = { method: "PUT", body: "private update body" };
  const original = new Response("unchanged");
  const f = setup((call) => { assert.equal(call.input, input); assert.equal(call.init, init); return original; });
  assert.equal(await f.bounded(input, init), original);
  assert.equal(f.calls.length, 1);
});

function cookieSession(expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  return { access_token: TOKEN, refresh_token: "private-refresh", expires_at: expiresAt, token_type: "bearer", user: { id: USER, aud: "authenticated" } };
}

test("real SSR cookie getUser recovers its user GET; refresh POST is not replayed by the wrapper", async () => {
  for (const expired of [false, true]) {
    let gets = 0; let posts = 0;
    const f = setup((call) => {
      if (call.init?.method === "POST") {
        posts++; assert.equal(String(call.input), `${URL}/auth/v1/token?grant_type=refresh_token`);
        return Response.json({ ...cookieSession(), expires_in: 3600 });
      }
      gets++; return gets === 1 ? new Response("temporary", { status: 504 }) : ok();
    });
    const session = cookieSession(expired ? 1 : undefined);
    const client = createServerClient(URL, "synthetic-key", {
      global: { fetch: f.bounded }, cookies: {
        getAll: () => [{ name: "sb-homa-auth-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` }],
        setAll: () => {},
      },
    });
    assert.equal((await client.auth.getUser()).data.user?.id, USER);
    assert.equal(gets, 2);
    assert.equal(posts, expired ? 1 : 0);
  }
});

function configure(t: TestContext) {
  const old = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = URL; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-key";
  t.after(() => {
    if (old.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = old.url;
    if (old.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = old.key;
  });
}

test("actual resolveApiFamily call-site recovery is opt-in and covers cookie plus bearer with unchanged RLS scope", async (t) => {
  configure(t);
  for (const transport of ["cookie", "bearer"]) {
    for (const optedIn of [false, true]) {
      let gets = 0; let membership = 0;
      t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${TOKEN}`);
        if (path === `${URL}/auth/v1/user`) { gets++; return gets === 1 ? new Response("temporary", { status: 504 }) : ok(); }
        assert.ok(path.startsWith(`${URL}/rest/v1/family_members?`));
        assert.ok(path.includes(`user_id=eq.${USER}`));
        membership++; return Response.json([{ family_id: FAMILY }]);
      });
      const request = new Request("https://homa.invalid/api/chat/session-binding", { headers: transport === "bearer"
        ? { authorization: `Bearer ${TOKEN}` }
        : { cookie: `sb-homa-auth-auth-token=base64-${Buffer.from(JSON.stringify(cookieSession())).toString("base64url")}` } });
      const result = await resolveApiFamily(request, optedIn ? { transientAuthErrors: "throw" } : undefined);
      assert.equal(result?.familyId ?? null, optedIn ? FAMILY : null);
      assert.equal(gets, optedIn ? 2 : 1); assert.equal(membership, optedIn ? 1 : 0);
    }
  }
});

test("exhausted real SDK Auth stops Eve admission without fallback, model calls or private logs", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  const f = setup(() => new Response("private upstream body", { status: 504 }));
  let fallbacks = 0; let admitted = 0;
  const response = await routeAuth(new Request("https://homa.invalid/eve/v1/session"), [
    async () => { await readEveAuthentication(() => f.client.auth.getUser(TOKEN), "authenticate"); admitted++; return null; },
    () => { fallbacks++; return null; },
  ]);
  assert.ok(response instanceof Response);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "1");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(f.calls.length, 2); assert.equal(fallbacks, 0); assert.equal(admitted, 0);
  assert.ok(f.calls.every((call) => String(call.input) === `${URL}/auth/v1/user`));
  assert.doesNotMatch(JSON.stringify(logs), /private|synthetic-jwt|11111111/);
});
