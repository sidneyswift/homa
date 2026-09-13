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

test("gate diagnostics require an explicit preview-only opt-in", () => {
  const messages: string[] = [];
  const log = (message: string) => { messages.push(message); };
  for (const diagnostics of [undefined, "", "0", "true"]) {
    assert.equal(chatOpenWarmupEnabled({ ...fixture, diagnostics }, log), true);
  }
  for (const environment of [undefined, "production", "development", ""]) {
    assert.equal(chatOpenWarmupEnabled({ ...fixture, environment, diagnostics: "1" }, log), false);
  }
  assert.deepEqual(messages, []);
});

test("gate diagnostics emit only seven bounded booleans, never supplied identity or extra data", () => {
  const messages: string[] = [];
  const privateValue = "private-test-value-".repeat(500);
  const input = {
    ...fixture,
    diagnostics: "1",
    userId: privateValue,
    fixtureUserId: privateValue,
    auth: { token: "private-token" },
    family: { name: "Private family" },
    prompt: "Private prompt",
  };
  assert.equal(chatOpenWarmupEnabled(input, message => { messages.push(message); }), true);
  assert.equal(messages.length, 1);
  assert(messages[0].startsWith("[chat-open-warmup-gate] "));
  assert(messages[0].length < 256);
  const record = JSON.parse(messages[0].slice("[chat-open-warmup-gate] ".length));
  assert.deepEqual(record, {
    environmentIsPreview: true,
    flagIsOne: true,
    hasFamily: true,
    userIsNotAnonymous: true,
    fixtureIdPresent: true,
    userMatchesFixtureId: true,
    enabled: true,
  });
  assert(Object.values(record).every(value => typeof value === "boolean"));
  assert(!messages[0].includes("private"));
  assert(!messages[0].includes("Private"));
});

test("negative preview diagnostics distinguish the failed gate without enabling warmup", () => {
  const cases = [
    { override: { flag: "0" }, field: "flagIsOne" },
    { override: { hasFamily: false }, field: "hasFamily" },
    { override: { userId: "anonymous" }, field: "userIsNotAnonymous" },
    { override: { fixtureUserId: undefined }, field: "fixtureIdPresent" },
    { override: { userId: "another-user" }, field: "userMatchesFixtureId" },
  ];
  for (const { override, field } of cases) {
    const messages: string[] = [];
    assert.equal(chatOpenWarmupEnabled({ ...fixture, ...override, diagnostics: "1" }, message => { messages.push(message); }), false);
    assert.equal(messages.length, 1);
    const record = JSON.parse(messages[0].slice("[chat-open-warmup-gate] ".length));
    assert.equal(record[field], false);
    assert.equal(record.enabled, false);
    assert.equal(record.environmentIsPreview, true);
    assert.equal(Object.keys(record).length, 7);
    assert(Object.values(record).every(value => typeof value === "boolean"));
  }
});

test("a diagnostic logger failure cannot affect the gate decision", () => {
  const log = () => { throw new Error("diagnostic unavailable"); };
  assert.equal(chatOpenWarmupEnabled({ ...fixture, diagnostics: "1" }, log), true);
  assert.equal(chatOpenWarmupEnabled({ ...fixture, flag: "0", diagnostics: "1" }, log), false);
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
