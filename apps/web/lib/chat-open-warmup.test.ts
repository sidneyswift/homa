import assert from "node:assert/strict";
import { test } from "node:test";

import { chatOpenWarmupEnabled, startChatOpenWarmup } from "./chat-open-warmup";

const fixture = {
  environment: "preview", flag: "1", fixtureUserId: "synthetic-user",
  userId: "synthetic-user", hasFamily: true,
};

test("warmup is restricted to the configured authenticated preview fixture", () => {
  assert.equal(chatOpenWarmupEnabled(fixture), true);
  for (const override of [
    { environment: "production" }, { environment: "development" }, { environment: undefined },
    { flag: undefined }, { flag: "0" }, { flag: "true" },
    { fixtureUserId: undefined }, { fixtureUserId: "" }, { userId: "another-user" },
    { userId: "anonymous", fixtureUserId: "anonymous" }, { hasFamily: false },
  ]) assert.equal(chatOpenWarmupEnabled({ ...fixture, ...override }), false);
});

test("warmup sends one uncached health GET and releases the response body", async () => {
  const calls: unknown[][] = [];
  let released = false;
  const warmup = startChatOpenWarmup(async (...args) => {
    calls.push(args);
    return new Response(new ReadableStream({ cancel() { released = true; } }));
  });
  assert.equal(typeof warmup.cancel, "function");
  assert.equal(await warmup.done, true);
  assert.equal(calls.length, 1);
  const [url, options] = calls[0] as [string, RequestInit];
  assert.equal(url, "/eve/v1/health");
  assert.equal(options.method, "GET");
  assert.equal(options.credentials, "same-origin");
  assert.equal(options.cache, "no-store");
  assert.equal(options.redirect, "error");
  assert.equal(options.body, undefined);
  assert.equal(options.headers, undefined);
  assert.equal(released, true);
});

test("a failed health request neither throws nor retries", async () => {
  for (const result of ["throw", "reject", "http"] as const) {
    let calls = 0;
    const warmup = startChatOpenWarmup(() => {
      calls++;
      if (result === "throw") throw new Error("network unavailable");
      if (result === "reject") return Promise.reject(new Error("network unavailable"));
      return Promise.resolve(new Response(null, { status: 503 }));
    });
    assert.equal(await warmup.done, false);
    assert.equal(calls, 1);
  }
});

test("setup, immediate cleanup and setup leave one live health request", async () => {
  let calls = 0;
  const fetchHealth: typeof fetch = async () => { calls++; return new Response(null); };
  const abandoned = startChatOpenWarmup(fetchHealth);
  abandoned.cancel();
  const active = startChatOpenWarmup(fetchHealth);
  assert.equal(await abandoned.done, false);
  assert.equal(await active.done, true);
  assert.equal(calls, 1);
});

test("leaving chat cancels pending warmup without an unhandled rejection", async () => {
  let started!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const warmup = startChatOpenWarmup((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    started();
  }));
  await entered;
  warmup.cancel();
  assert.equal(await warmup.done, false);
});

test("slow health requests are aborted after ten seconds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal | null | undefined;
  const warmup = startChatOpenWarmup((_url, options) => new Promise((_resolve, reject) => {
    signal = options?.signal;
    signal?.addEventListener("abort", () => reject(new Error("deadline")), { once: true });
  }));
  await Promise.resolve();
  t.mock.timers.tick(9_999);
  assert.equal(signal?.aborted, false);
  t.mock.timers.tick(1);
  assert.equal(signal?.aborted, true);
  assert.equal(await warmup.done, false);
});
