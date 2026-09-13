import assert from "node:assert/strict";
import { test } from "node:test";

import { streamText, tool, wrapLanguageModel } from "ai";
import { MockLanguageModelV4, MockProviderV4 } from "ai/test";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import { createChatModelRace, registerPreviewChatModelRace } from "./chat-model-race";

type Result = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type Part = Result["stream"] extends ReadableStream<infer P> ? P : never;
const finish: Part = { type: "finish", finishReason: { unified: "stop", raw: "stop" },
  usage: { inputTokens: { total: 11, noCache: 11, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 3, text: 3, reasoning: 0 } } };
function stream(parts: Part[]) {
  return new ReadableStream<Part>({ start(controller) {
    for (const part of parts) controller.enqueue(part);
    controller.close();
  } });
}
function answer(text: string): Part[] {
  return [{ type: "stream-start", warnings: [] }, { type: "text-start", id: "answer" },
    { type: "text-delta", id: "answer", delta: text }, { type: "text-end", id: "answer" }, finish];
}
function wrap(model: MockLanguageModelV4) {
  return wrapLanguageModel({ model, middleware: createChatModelRace() });
}

test("real SDK executes only the winning tool, preserving medium and ignoring hidden reasoning", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "info", (...args: unknown[]) => { logs.push(args); });
  let opened = 0;
  let loserCancelled = false;
  let loserSignal: AbortSignal | undefined;
  const model = new MockLanguageModelV4({ doStream: async params => {
    const index = opened++;
    assert.equal(params.reasoning, "medium");
    assert.equal(params.tools?.length, 1);
    assert.equal(params.providerOptions?.gateway?.caching, "auto");
    if (index === 0) {
      loserSignal = params.abortSignal;
      return { stream: new ReadableStream<Part>({ start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        controller.enqueue({ type: "reasoning-start", id: "hidden" });
        controller.enqueue({ type: "reasoning-delta", id: "hidden", delta: "private-loser-reasoning" });
      }, cancel() {
        loserCancelled = true;
        // A cancellation acknowledgement that never settles cannot delay the winner.
        return new Promise<void>(() => {});
      } }) };
    }
    return { response: { headers: { "x-winner": "second" } }, stream: stream([
      { type: "stream-start", warnings: [] },
      { type: "tool-input-start", id: "selected-tool", toolName: "save" },
      { type: "tool-input-delta", id: "selected-tool", delta: '{"value":"selected"}' },
      { type: "tool-input-end", id: "selected-tool" },
      { type: "tool-call", toolCallId: "selected-tool", toolName: "save", input: '{"value":"selected"}' },
      { ...finish, finishReason: { unified: "tool-calls", raw: "tool_calls" } },
    ]) };
  } });
  const writes: string[] = [];
  const result = streamText({ model: wrap(model), prompt: "synthetic request", reasoning: "medium", maxRetries: 0,
    providerOptions: { gateway: { caching: "auto" } },
    tools: { save: tool({ inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => { writes.push(value); return { saved: true }; } }) } });
  const chunks = [];
  for await (const chunk of result.fullStream) chunks.push(chunk.type);
  assert.deepEqual(writes, ["selected"]);
  assert.equal(opened, 2);
  assert.ok(loserCancelled && loserSignal?.aborted);
  assert.equal(chunks.includes("reasoning-delta"), false);
  assert.equal((await result.response).headers?.["x-winner"], "second");
  assert.equal((await result.usage).inputTokens, 11);
  assert.doesNotMatch(JSON.stringify(logs), /private-|synthetic request|selected-tool/);
});

test("one connection failure does not lose the good stream or its response metadata", async (t) => {
  t.mock.method(console, "info", () => { throw new Error("logger failed"); });
  let opened = 0;
  const model = new MockLanguageModelV4({ doStream: async () => {
    if (opened++ === 0) throw new Error("first connection failed");
    return { response: { headers: { "x-winner": "good" } }, stream: stream(answer("Useful answer")) };
  } });
  const result = streamText({ model: wrap(model), prompt: "synthetic", maxRetries: 0 });
  assert.equal(await result.text, "Useful answer");
  assert.equal((await result.response).headers?.["x-winner"], "good");
});

test("two ready tool proposals still execute one app write", async (t) => {
  t.mock.method(console, "info", () => {});
  let opened = 0;
  const model = new MockLanguageModelV4({ doStream: async () => {
    const index = opened++;
    return { stream: stream([{ type: "stream-start", warnings: [] },
      { type: "tool-call", toolName: "save", toolCallId: `proposal-${index}`, input: JSON.stringify({ value: index }) },
      { ...finish, finishReason: { unified: "tool-calls", raw: "tool_calls" } }]) };
  } });
  const writes: number[] = [];
  const result = streamText({ model: wrap(model), prompt: "synthetic", maxRetries: 0,
    tools: { save: tool({ inputSchema: z.object({ value: z.number() }),
      execute: async ({ value }) => { writes.push(value); return { saved: true }; } }) } });
  await result.consumeStream();
  assert.equal(opened, 2);
  assert.equal(writes.length, 1);
  assert.equal((await result.toolResults).length, 1);
});

test("cancelling an already selected stream aborts its remaining provider work", async (t) => {
  t.mock.method(console, "info", () => {});
  const signals: AbortSignal[] = [];
  const model = new MockLanguageModelV4({ doStream: async params => {
    signals.push(params.abortSignal!);
    return { stream: new ReadableStream<Part>({ start(controller) {
      controller.enqueue({ type: "text-start", id: "answer" });
      controller.enqueue({ type: "text-delta", id: "answer", delta: "Starting" });
    } }) };
  } });
  const result = await wrap(model).doStream({ prompt: [] });
  const reader = result.stream.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal(signals.length, 2);
  assert.ok(signals.every(signal => signal.aborted));
});

test("a stream failure after winning remains partial and never starts a replacement tool", async () => {
  let opened = 0;
  const model = new MockLanguageModelV4({ doStream: async () => ({ stream: stream(opened++ === 0
    ? [...answer("Partial").slice(0, 3), { type: "error", error: new Error("winning stream failed") }]
    : answer("Losing answer")) }) });
  const result = streamText({ model: wrap(model), prompt: "synthetic", maxRetries: 0 });
  const parts = [];
  for await (const part of result.fullStream) parts.push(part);
  assert.equal(parts.filter(part => part.type === "text-delta").map(part => part.text).join(""), "Partial");
  assert.equal(parts.filter(part => part.type === "error").length, 1);
  assert.equal(opened, 2);
});

test("both in-stream failures stay stream failures without an extra SDK retry", async () => {
  let opened = 0;
  const model = new MockLanguageModelV4({ doStream: async () => {
    opened++;
    return { stream: stream([{ type: "stream-start", warnings: [] },
      { type: "error", error: new Error("stream failed before text") }]) };
  } });
  const result = streamText({ model: wrap(model), prompt: "synthetic", maxRetries: 2 });
  const types = [];
  for await (const part of result.fullStream) types.push(part.type);
  assert.equal(types.filter(type => type === "error").length, 1);
  assert.equal(opened, 2);
});

test("parent cancellation stops both pending streams and starts none if already aborted", async () => {
  let opened = 0;
  const signals: AbortSignal[] = [];
  const controller = new AbortController();
  const model = new MockLanguageModelV4({ doStream: async params => {
    opened++;
    signals.push(params.abortSignal!);
    if (opened === 2) queueMicrotask(() => controller.abort());
    return { stream: new ReadableStream<Part>() };
  } });
  const wrapped = wrap(model);
  await assert.rejects(async () => await wrapped.doStream({ prompt: [], abortSignal: controller.signal }));
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(opened, 2);
  await assert.rejects(async () => await wrapped.doStream({ prompt: [], abortSignal: AbortSignal.abort() }));
  assert.equal(opened, 2);
});

test("provider-run tools and raw-stream consumers receive a single unchanged request", async () => {
  let opened = 0;
  const model = new MockLanguageModelV4({ doStream: async () => { opened++; return { stream: stream(answer("One")) }; } });
  const wrapped = wrap(model);
  const provider = await wrapped.doStream({ prompt: [], tools: [{ type: "provider", name: "remote", id: "provider.remote", args: {} }] });
  for await (const part of provider.stream) assert.ok(part.type);
  const raw = await wrapped.doStream({ prompt: [], includeRawChunks: true });
  for await (const part of raw.stream) assert.ok(part.type);
  assert.equal(opened, 2);
});

test("registration preserves string resolution and only races main-agent Astra streaming", async (t) => {
  t.mock.method(console, "info", () => {});
  const previousEnv = [process.env.VERCEL_ENV, process.env.HOMA_PREVIEW_MODEL_RACE];
  const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
  let opened = 0;
  const model = new MockLanguageModelV4({ modelId: HOMA_MODEL, doStream: async params => {
    opened++;
    assert.equal(params.reasoning, "medium");
    assert.equal(params.providerOptions?.gateway?.caching, "auto");
    return { stream: stream(answer("Answer")) };
  } });
  const provider = new MockProviderV4({ languageModels: { [HOMA_MODEL]: model, "test/specialist": model } });
  let embeddingReceiverPreserved = false;
  const embedding = provider.embeddingModel;
  provider.embeddingModel = function (id) { embeddingReceiverPreserved = this === provider; return embedding(id); };
  try {
    globalThis.AI_SDK_DEFAULT_PROVIDER = provider;
    process.env.VERCEL_ENV = "production"; process.env.HOMA_PREVIEW_MODEL_RACE = "1";
    registerPreviewChatModelRace();
    assert.equal(globalThis.AI_SDK_DEFAULT_PROVIDER, provider);
    process.env.VERCEL_ENV = "preview"; process.env.HOMA_PREVIEW_MODEL_RACE = "0";
    registerPreviewChatModelRace();
    assert.equal(globalThis.AI_SDK_DEFAULT_PROVIDER, provider);
    process.env.HOMA_PREVIEW_MODEL_RACE = "1";
    registerPreviewChatModelRace();
    const registered = globalThis.AI_SDK_DEFAULT_PROVIDER;
    registerPreviewChatModelRace();
    assert.equal(globalThis.AI_SDK_DEFAULT_PROVIDER, registered);
    assert.equal(registered.languageModel(HOMA_MODEL).modelId, HOMA_MODEL);
    assert.throws(() => registered.embeddingModel("missing"));
    assert.ok(embeddingReceiverPreserved);
    const call = async (id: string, headers?: Record<string, string>) => {
      const result = streamText({ model: id, headers, prompt: "synthetic", reasoning: "medium",
        providerOptions: { gateway: { caching: "auto" } }, maxRetries: 0 });
      assert.equal(await result.text, "Answer");
    };
    await call(HOMA_MODEL, { "x-title": "web" });
    assert.equal(opened, 2);
    await call(HOMA_MODEL);
    assert.equal(opened, 3);
    await call(HOMA_MODEL, { "x-title": "specialist" });
    assert.equal(opened, 4);
    await call("test/specialist", { "x-title": "web" });
    assert.equal(opened, 5);
    process.env.VERCEL_ENV = "production";
    await call(HOMA_MODEL, { "x-title": "web" });
    assert.equal(opened, 6);
  } finally {
    globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider;
    for (const [index, key] of ["VERCEL_ENV", "HOMA_PREVIEW_MODEL_RACE"].entries()) {
      if (previousEnv[index] === undefined) delete process.env[key]; else process.env[key] = previousEnv[index];
    }
  }
});
