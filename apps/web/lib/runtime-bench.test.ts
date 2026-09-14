import assert from "node:assert/strict";
import { test } from "node:test";

import { BENCH_DEADLINE, benchEnabled, createSavedPublisher, readSse } from "./runtime-bench";

test("experiment is unavailable in production, without its reserved user, and after expiry", () => {
  const env = { VERCEL_ENV: "preview", HOMA_RUNTIME_BENCH_USER_ID: "reserved" };
  assert.equal(benchEnabled(env, BENCH_DEADLINE - 1), true);
  assert.equal(benchEnabled(env, BENCH_DEADLINE), false);
  assert.equal(benchEnabled({ ...env, VERCEL_ENV: "production" }, 0), false);
  assert.equal(benchEnabled({ VERCEL_ENV: "preview" }, 0), false);
});

test("text is never shown before save and concurrent deltas are preserved", async () => {
  const writes: string[] = [], shown: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const publisher = createSavedPublisher(async (text) => { await gate; writes.push(text); }, (text) => { assert.equal(writes.at(-1), text); shown.push(text); });
  publisher.update("Hi"); publisher.update("Hi Sam"); publisher.update("Hi Sam!");
  assert.deepEqual(shown, []);
  release();
  assert.equal(await publisher.finish(), "Hi Sam!");
  assert.equal(shown.at(-1), "Hi Sam!");
});

test("a failed save fails closed instead of publishing unsaved text", async () => {
  const shown: string[] = [];
  const publisher = createSavedPublisher(async () => { throw new Error("database down"); }, (text) => shown.push(text));
  publisher.update("hello");
  await assert.rejects(publisher.finish(), /database down/);
  assert.deepEqual(shown, []);
});

test("SSE parser retains split UTF-8 and multiple events in one chunk", async () => {
  const bytes = new TextEncoder().encode('data: {"type":"delta","delta":"café"}\n\ndata: {"type":"done"}\n\n');
  const split = bytes.indexOf(195) + 1;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.slice(0, split)); controller.enqueue(bytes.slice(split)); controller.close(); } });
  const events = [];
  for await (const event of readSse(stream)) events.push(event);
  assert.deepEqual(events, [{ type: "delta", delta: "café" }, { type: "done" }]);
});

test("truncated provider frames do not become successful answers", async () => {
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"done"')); controller.close(); } });
  await assert.rejects(async () => { for await (const event of readSse(stream)) assert.fail(String(event)); }, /partial event/);
});
