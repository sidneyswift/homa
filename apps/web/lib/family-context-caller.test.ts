import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";

import { createClient } from "@supabase/supabase-js";

import { resolveFamilyContextInstructionMarkdown } from "../agent/instructions/family-context";
import { loadCallerFamilyContext, loadCallerFamilyContextRows } from "./family-context-caller";

const familyId = "synthetic-family";
const token = "synthetic-private-jwt";
const records = {
  families: [{ name: "synthetic-private-family", us_state: "NY", parent_display_name: "Parent", time_zone: "America/New_York" }],
  children: [{ id: "synthetic-child", name: "Child", birth_month: "2020-01-01", profile: null, avatar_url: null }],
  family_memories: [{ id: "synthetic-memory", child_id: null, kind: "fact", content: "synthetic-private-memory", source: "parent", created_at: "2026-09-12T12:00:00Z" }],
  family_members: [{ display_name: "Parent" }],
};
type Table = keyof typeof records;
interface FetchCall {
  table: Table;
  attempt: number;
  url: URL;
  headers: Headers;
  signal: AbortSignal;
}

function fixture(respond: (call: FetchCall) => Response | Promise<Response> = success) {
  const calls: FetchCall[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, "https://family-context-fixture.invalid");
    assert.equal(init?.method, "GET", "context recovery must never retry a write");
    const table = url.pathname.split("/").at(-1) as Table;
    assert.ok(Object.hasOwn(records, table), "only the four context tables may be read");
    assert.ok(init.signal instanceof AbortSignal);
    const call = {
      table,
      attempt: calls.filter((previous) => previous.table === table).length + 1,
      url,
      headers: new Headers(init.headers),
      signal: init.signal,
    };
    calls.push(call);
    return respond(call);
  };
  const db = createClient("https://family-context-fixture.invalid", "synthetic-publishable-key", {
    global: { fetch: fetcher, headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, familyId, calls };
}

function success(call: FetchCall): Response {
  return Response.json(records[call.table]);
}

function stalled(call: FetchCall, onAbort: () => void = () => {}): Promise<Response> {
  return new Promise((_resolve, reject) => {
    assert.equal(call.signal.aborted, false);
    call.signal.addEventListener("abort", () => {
      onAbort();
      reject(new DOMException("synthetic-private-abort", "AbortError"));
    }, { once: true });
  });
}

function counts(calls: FetchCall[]) {
  return Object.fromEntries(Object.keys(records).map((table) => [
    table, calls.filter((call) => call.table === table).length,
  ]));
}

test("504 recovery repeats only the failed GET with identical JWT, projections, and family scope", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const client = fixture((call) => call.table === "families" && call.attempt === 1
    ? new Response("synthetic-private-gateway-error", { status: 504 })
    : success(call));
  const result = await loadCallerFamilyContextRows(client, {
    trace: { sessionId: "session-test", turnId: "turn-test" },
  });
  assert.deepEqual(result, {
    family: records.families[0], children: records.children,
    memories: records.family_memories, members: records.family_members,
  });
  assert.deepEqual(counts(client.calls), { families: 2, children: 1, family_memories: 1, family_members: 1 });
  for (const call of client.calls) {
    assert.equal(call.headers.get("authorization"), `Bearer ${token}`);
    assert.equal(call.headers.get("x-retry-count"), null, "the SDK must not add retries inside our budget");
    assert.equal(call.url.searchParams.get(call.table === "families" ? "id" : "family_id"), `eq.${familyId}`);
    assert.equal(call.url.href, client.calls.find((first) => first.table === call.table)!.url.href);
  }
  const params = Object.fromEntries(client.calls.filter((call) => call.attempt === 1).map((call) => [call.table, Object.fromEntries(call.url.searchParams)]));
  assert.deepEqual(params, {
    families: { select: "name,us_state,parent_display_name,time_zone", id: `eq.${familyId}` },
    children: { select: "id,name,birth_month,profile,avatar_url", family_id: `eq.${familyId}`, order: "created_at.asc" },
    family_memories: { select: "id,child_id,kind,content,source,created_at", family_id: `eq.${familyId}`, superseded_at: "is.null", kind: "in.(fact,what_works)", order: "created_at.asc", limit: "200" },
    family_members: { select: "display_name", family_id: `eq.${familyId}`, order: "created_at.asc" },
  });
  assert.equal(logs.length, 1);
  assert.deepEqual(JSON.parse(logs[0][1] as string), {
    stage: "family_context_recovered", startedAtMs: JSON.parse(logs[0][1] as string).startedAtMs,
    durationMs: 0, outcome: "ok", sessionId: "session-test", turnId: "turn-test",
  });
  assert.doesNotMatch(JSON.stringify(logs), /synthetic-private|synthetic-family|authorization|content/);
});

test("healthy reads stay parallel and do not emit a recovery marker", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const release: (() => void)[] = [];
  const client = fixture((call) => new Promise<Response>((resolve) => {
    release.push(() => resolve(success(call)));
  }));
  const pending = loadCallerFamilyContextRows(client);
  await sleep(0);
  assert.equal(client.calls.length, 4);
  for (const finish of release) finish();
  await pending;
  assert.deepEqual(counts(client.calls), { families: 1, children: 1, family_memories: 1, family_members: 1 });
  assert.deepEqual(logs, []);
});

test("persistent 503 and 504 stop at two attempts without SDK backoff or retries", async (t) => {
  for (const status of [503, 504]) {
    await t.test(String(status), async () => {
      const client = fixture((call) => call.table === "families"
        ? new Response("synthetic-private-upstream-error", { status })
        : success(call));
      await assert.rejects(loadCallerFamilyContextRows(client, { attemptMs: 50, totalMs: 100 }), /family context load failed/);
      assert.deepEqual(counts(client.calls), { families: 2, children: 1, family_memories: 1, family_members: 1 });
      assert.ok(client.calls.every((call) => call.headers.get("x-retry-count") === null));
    });
  }
});

test("transport failure gets one same-caller retry", async () => {
  const client = fixture((call) => {
    if (call.table === "children" && call.attempt === 1) throw new TypeError("synthetic-private-network-error");
    return success(call);
  });
  assert.deepEqual((await loadCallerFamilyContextRows(client)).children, records.children);
  assert.deepEqual(counts(client.calls), { families: 1, children: 2, family_memories: 1, family_members: 1 });
});

test("401, 403, permanent query errors, and SQL errors never retry and cancel sibling reads", async (t) => {
  for (const [status, code] of [[401, ""], [403, ""], [400, "PGRST100"], [500, "42703"], [503, "42501"]] as const) {
    await t.test(`${status}:${code}`, async () => {
      let cancelled = 0;
      const client = fixture((call) => call.table === "families"
        ? Response.json({ code, message: "synthetic-private-denial" }, { status })
        : stalled(call, () => { cancelled += 1; }));
      await assert.rejects(loadCallerFamilyContextRows(client, { attemptMs: 50, totalMs: 100 }), /family context load failed/);
      assert.deepEqual(counts(client.calls), { families: 1, children: 1, family_memories: 1, family_members: 1 });
      assert.equal(cancelled, 3);
    });
  }
});

test("an attempt timeout aborts its request before retrying only that query", async () => {
  let cancelled = 0;
  const client = fixture((call) => call.table === "families" && call.attempt === 1
    ? stalled(call, () => { cancelled += 1; })
    : success(call));
  const result = await loadCallerFamilyContextRows(client, { attemptMs: 25, totalMs: 150 });
  assert.equal(cancelled, 1);
  assert.deepEqual(result.family, records.families[0]);
  assert.deepEqual(counts(client.calls), { families: 2, children: 1, family_memories: 1, family_members: 1 });
  assert.equal(client.calls[0].signal.aborted, true);
});

test("the absolute batch deadline cancels all requests even before the first attempt expires", async () => {
  let cancelled = 0;
  const client = fixture((call) => stalled(call, () => { cancelled += 1; }));
  await assert.rejects(loadCallerFamilyContextRows(client, { attemptMs: 200, totalMs: 25 }), /family context load failed/);
  assert.equal(cancelled, 4);
  await sleep(40);
  assert.equal(client.calls.length, 4, "deadline must not permit a later retry");
});

test("caller cancellation aborts active reads and never retries or starts a pre-cancelled batch", async () => {
  const controller = new AbortController();
  let cancelled = 0;
  const client = fixture((call) => stalled(call, () => { cancelled += 1; }));
  const pending = loadCallerFamilyContextRows(client, { signal: controller.signal, attemptMs: 100, totalMs: 200 });
  const rejection = assert.rejects(pending, /family context load failed/);
  await sleep(0);
  controller.abort();
  await rejection;
  assert.equal(cancelled, 4);
  assert.equal(client.calls.length, 4);
  const before = client.calls.length;
  await assert.rejects(loadCallerFamilyContextRows(client, { signal: controller.signal }), /family context load failed/);
  assert.equal(client.calls.length, before);
});

test("a fetch that ignores abort cannot overrun the budget or produce late retries or recovery", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  const release: (() => void)[] = [];
  const client = fixture((call) => new Promise<Response>((resolve) => {
    release.push(() => resolve(success(call)));
  }));
  await assert.rejects(loadCallerFamilyContextRows(client, { attemptMs: 15, totalMs: 40 }), /family context load failed/);
  const attemptsAtFailure = client.calls.length;
  assert.ok(attemptsAtFailure >= 4 && attemptsAtFailure <= 8);
  assert.ok(client.calls.every((call) => call.signal.aborted));
  for (const finish of release) finish();
  await sleep(50);
  assert.equal(client.calls.length, attemptsAtFailure);
  assert.deepEqual(logs, []);
});

test("exhausted caller recovery retains honest fallback and never starts pinned or secondary reads", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  const client = fixture((call) => call.table === "families"
    ? new Response("synthetic-private-gateway-error", { status: 504 })
    : success(call));
  const unexpected = async (): Promise<never> => { assert.fail("failed caller reads must never gain pinned access"); };
  const markdown = await resolveFamilyContextInstructionMarkdown({
    sessionId: "session-test", turnId: "turn-test",
    attributes: { channel: "web", familyId, supabaseAccessToken: token },
  }, {
    loadCallerFamilyContext: async () => loadCallerFamilyContextRows(client),
    loadPinnedFamilyContext: unexpected,
    renderFamilyContext: () => { assert.fail("partial rows must not render"); },
    loadProgressContext: unexpected,
    loadOnboardingContext: unexpected,
    loadContinuityContext: unexpected,
    loadRecentCallsContext: unexpected,
    recordContextSnapshot: unexpected,
  });
  assert.match(markdown!, /family context could not be loaded/);
  const markers = logs.filter((log) => log[0] === "[chat-preparation]").map((log) => JSON.parse(log[1] as string));
  assert.ok(markers.some((marker) => marker.stage === "family_context_degraded" && marker.turnId === "turn-test"));
  assert.ok(markers.every((marker) => marker.stage !== "family_context_recovered"));
  assert.doesNotMatch(JSON.stringify(logs), /synthetic-private|synthetic-family|authorization|content/);
});

test("production entry point still rejects missing caller auth before reading", async () => {
  await assert.rejects(loadCallerFamilyContext({ familyId }), { name: "MissingFamilyContextError" });
  await assert.rejects(loadCallerFamilyContext({ supabaseAccessToken: token }), { name: "MissingFamilyContextError" });
});
