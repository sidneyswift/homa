#!/usr/bin/env node
/**
 * Eve 0.19 ordered-stream regression guard. Runs the installed patched package,
 * including its unchanged Workflow serializer, writer, pump and lock polling.
 * Synthetic provider and World only. No model calls, credentials or payload logs.
 * Keep this file at scripts/eve-ordered-stream-emitter.test.mjs.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import * as candidate from "../apps/web/node_modules/eve/dist/src/harness/emission.js";
import { createOrderedStreamEmitter } from "../apps/web/node_modules/eve/dist/src/harness/ordered-stream-emitter.js";
import { createProviderStreamActionBatch } from "../apps/web/node_modules/eve/dist/src/harness/stream-actions.js";
import { requestAuthorization } from "../apps/web/node_modules/eve/dist/src/harness/authorization.js";
import { EMPTY_DELIVERY_SENTINEL } from "../apps/web/node_modules/eve/dist/src/shared/empty-delivery.js";
import * as protocol from "../apps/web/node_modules/eve/dist/src/protocol/message.js";
import {
  h as WorkflowServerWritableStream,
  yn as flushablePipe,
  vn as createFlushableState,
  bn as pollWritableLock,
  w as getSerializeStream,
  S as getExternalReducers,
} from "../apps/web/node_modules/eve/dist/src/compiled/_chunks/workflow/attribute-changes-zAifvEhb.js";

globalThis.fetch = async () => { throw new Error("Network is forbidden in this regression guard."); };
const installedPackage = JSON.parse(await readFile(new URL("../apps/web/node_modules/eve/package.json", import.meta.url), "utf8"));
assert.equal(installedPackage.version, "0.19.0", "Review this private-runtime regression guard before changing Eve versions.");
const workflowBytes = await readFile(new URL("../apps/web/node_modules/eve/dist/src/compiled/_chunks/workflow/attribute-changes-zAifvEhb.js", import.meta.url));
assert.equal(createHash("sha256").update(workflowBytes).digest("hex"), "1273b71e6f6daf01189fbf56474b10930eb562f364955a79102955ce014283b4", "Workflow changed; review private export aliases and settlement semantics.");
const check = (name, run) => test(name, { timeout: 5000, concurrency: false }, run);
const state = { sessionStarted: true, sequence: 7, stepIndex: 2, turnId: "synthetic-turn" };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); promise.catch(() => {}); return { promise, resolve, reject }; };
const microtasks = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function until(check) { const deadline = performance.now() + 2500; while (!check()) { assert.ok(performance.now() < deadline, "Controlled condition timed out"); await delay(2); } }
async function* parts(items) { for (const item of items) yield item; }
const reasoning = (text) => ({ type: "reasoning-delta", id: "r", text });
const text = (text) => ({ type: "text-delta", id: "t", text });
const finish = { type: "finish-step", finishReason: "stop" };
const append = (delta, soFar, coordinates = {}) => protocol.createMessageAppendedEvent({ messageDelta: delta, messageSoFar: soFar, ...state, ...coordinates });
const reasonAppend = (delta, soFar) => protocol.createReasoningAppendedEvent({ reasoningDelta: delta, reasoningSoFar: soFar, ...state });
await check("original cumulative fields, coordinates, metadata and context survive adjacent coalescing", async () => {
  const gate = deferred(), seen = [], contexts = [];
  const emitter = createOrderedStreamEmitter(async (event, messages) => { seen.push(event); contexts.push(messages); if (seen.length === 1) await gate.promise; });
  const one = [{ role: "user", content: "synthetic-one" }], two = [{ role: "user", content: "synthetic-two" }];
  await emitter.emit(append("A", "A"));
  await emitter.emit({ ...append("B", "AB"), meta: { at: "2026-09-12T00:00:00.000Z" } }, one);
  await emitter.emit({ ...append("C", "ABC"), meta: { at: "2026-09-12T00:00:01.000Z" } }, two);
  await emitter.emit(append("D", "D", { stepIndex: 3 }));
  await emitter.emit(reasonAppend("R", "R"));
  await emitter.emit(reasonAppend("S", "RS"));
  await emitter.emit(protocol.createReasoningCompletedEvent({ reasoning: "RS", ...state }));
  gate.resolve(); await emitter.closeAndDrain();
  assert.equal(seen.length, 5);
  assert.equal(seen[1].data.messageDelta, "BC"); assert.equal(seen[1].data.messageSoFar, "ABC");
  assert.equal(seen[1].meta.at, "2026-09-12T00:00:01.000Z"); assert.equal(contexts[1], two);
  assert.equal(seen[3].data.reasoningDelta, "RS"); assert.equal(seen[3].data.reasoningSoFar, "RS");
  assert.equal(seen[4].type, "reasoning.completed");
  await assert.rejects(emitter.emit(append("E", "E")), /closed/);
});

await check("pending limits count empty deltas and characters while excluding one active emission", async () => {
  for (const size of [0, 65536]) {
    const gate = deferred(); let calls = 0;
    const emitter = createOrderedStreamEmitter(async () => { calls++; if (calls === 1) await gate.promise; }, { maxPendingEvents: 2 });
    await emitter.emit(append("first", "first"));
    if (size === 0) await emitter.emit(reasonAppend("", ""));
    let accepted = false;
    const waiting = emitter.emit(reasonAppend("r".repeat(size), "r".repeat(size))).then(() => { accepted = true; });
    await microtasks(); assert.equal(accepted, false);
    gate.resolve(); await waiting; await emitter.closeAndDrain();
  }
});

await check("full reasoning and action boundaries retain source ordering", async () => {
  const events = [];
  const input = [reasoning("R"), reasoning("S"), text("before"), { type: "tool-call", providerExecuted: true, toolCallId: "p", toolName: "synthetic", input: {} }, { type: "tool-result", providerExecuted: true, toolCallId: "p", toolName: "synthetic", output: { ok: true } }, text("after"), finish];
  await candidate.emitStreamContent(async (event) => { await delay(1); events.push(event); }, state, parts(input));
  const boundaries = events.filter((event) => !["message.appended", "reasoning.appended"].includes(event.type));
  assert.deepEqual(boundaries.map((event) => event.type), ["reasoning.completed", "message.completed", "actions.requested", "action.result", "message.completed"]);
  assert.equal(boundaries[0].data.reasoning, "RS");
  assert.equal(boundaries[1].data.message, "before");
  assert.equal(boundaries[1].data.finishReason, "tool-calls");
  assert.equal(boundaries[2].data.actions[0].callId, "p");
  assert.equal(boundaries[3].data.result.callId, "p");
  assert.equal(boundaries[4].data.message, "after");
  assert.equal(events.filter((event) => event.type === "reasoning.appended").map((event) => event.data.reasoningDelta).join(""), "RS");
  assert.equal(events.filter((event) => event.type === "message.appended").map((event) => event.data.messageDelta).join(""), "beforeafter");
});

await check("provider error drains queued appends and preserves its Error identity without completion", async () => {
  const failure = new TypeError("synthetic provider failure"), seen = [];
  await assert.rejects(candidate.emitStreamContent(async (event) => { await delay(5); seen.push(event); }, state, parts([text("A"), text("B"), { type: "error", error: failure }])), (error) => error === failure);
  assert.equal(seen.map((event) => event.data.messageDelta ?? "").join(""), "AB");
  assert.ok(seen.every((event) => event.type === "message.appended"));
});

await check("writer or hook failure interrupts a stalled provider read and attempts return", async () => {
  const gate = deferred(), failure = new Error("synthetic hook failure"); let reads = 0, returned = false;
  const provider = { [Symbol.asyncIterator]() { return { next() { reads++; return reads === 1 ? Promise.resolve({ value: text("A"), done: false }) : new Promise(() => {}); }, return() { returned = true; return new Promise(() => {}); } }; } };
  const run = candidate.emitStreamContent(async () => gate.promise, state, provider);
  const rejection = assert.rejects(run, (error) => error === failure);
  await until(() => reads === 2); gate.reject(failure); await rejection;
  assert.equal(returned, true);
});

await check("sink failure wins over later provider error and drops undelivered queue", async () => {
  const sinkFailure = new Error("synthetic sink failure"), providerFailure = new Error("synthetic provider failure");
  const seen = [];
  await assert.rejects(candidate.emitStreamContent(async (event) => { seen.push(event); await delay(5); throw sinkFailure; }, state, parts([text("A"), text("B"), { type: "error", error: providerFailure }])), (error) => error === sinkFailure);
  assert.equal(seen.length, 1);
});

await check("thrown provider cancellation joins queued writes and cancels pending action timer", async () => {
  const abort = new DOMException("Synthetic cancelled", "AbortError"), seen = [];
  async function* cancelled() { yield { type: "tool-call", providerExecuted: true, toolCallId: "p", toolName: "synthetic", input: {} }; throw abort; }
  await assert.rejects(candidate.emitStreamContent(async (event) => { seen.push(event); }, state, cancelled()), (error) => error === abort);
  await delay(10); assert.equal(seen.length, 0);
  const gate = deferred(); let completed = false;
  async function* cancelledText() { yield text("A"); throw abort; }
  const run = candidate.emitStreamContent(async () => gate.promise, state, cancelledText()).catch((error) => { assert.equal(error, abort); completed = true; });
  await microtasks(); assert.equal(completed, false); gate.resolve(); await run;
});

await check("action cancellation joins already in-flight dispatch and prevents future observation", async () => {
  const gate = deferred(); let calls = 0, finished = false;
  const batch = createProviderStreamActionBatch({ state, emitFn: async () => { calls++; await gate.promise; } });
  batch.observe({ kind: "tool-call", callId: "p", toolName: "synthetic", input: {} });
  await until(() => calls === 1);
  const cancelling = batch.cancel().then(() => { finished = true; }); await microtasks(); assert.equal(finished, false);
  gate.resolve(); await cancelling; batch.observe({ kind: "tool-call", callId: "q", toolName: "synthetic", input: {} }); await delay(5); assert.equal(calls, 1);
});

await check("split empty-delivery sentinel keeps its null completion", async () => {
  const events = [];
  await candidate.emitStreamContent(async (event) => { events.push(event); }, state, parts([text(EMPTY_DELIVERY_SENTINEL.slice(0, 3)), text(EMPTY_DELIVERY_SENTINEL.slice(3)), finish]));
  assert.equal(events.filter((event) => event.type === "message.appended").map((event) => event.data.messageDelta).join(""), EMPTY_DELIVERY_SENTINEL);
  assert.equal(events.at(-1).type, "message.completed");
  assert.equal(events.at(-1).data.message, null);
});

await check("authorization results stay pending and only unseen inline results are collected", async () => {
  const output = requestAuthorization([{ name: "synthetic", challenge: { kind: "synthetic" }, hookUrl: "https://example.invalid/authorization" }]);
  // Eve collects result-only inline authorization. A call already observed in
  // this provider stream is skipped to avoid handling that authorization twice.
  for (const seenCall of [false, true]) {
    const events = [];
    const input = seenCall
      ? [{ type: "tool-call", toolCallId: "auth-1", toolName: "synthetic", input: {} }]
      : [];
    input.push(
      { type: "tool-result", toolCallId: "auth-1", toolName: "synthetic", output },
      { type: "finish-step", finishReason: "tool-calls" },
    );
    const result = await candidate.emitStreamContent(async (event) => { events.push(event); }, state, parts(input));
    assert.equal(result.inlineAuthorizationResults.length, seenCall ? 0 : 1);
    assert.equal(result.handledInlineToolResultCallIds.has("auth-1"), !seenCall);
    if (!seenCall) assert.equal(result.inlineAuthorizationResults[0].output, output);
    assert.equal(events.some((event) => event.type === "action.result"), false);
    assert.equal(events.some((event) => event.type === "message.completed"), false);
  }
});

await check("canonical preamble still awaits each handler before admitting the next event", async () => {
  const gate = deferred(), events = [];
  let finished = false;
  const run = candidate.emitTurnPreamble(async (event) => { events.push(event); if (events.length === 1) await gate.promise; }, { message: "Synthetic input" }, state, {}).then(() => { finished = true; });
  await microtasks();
  assert.deepEqual(events.map((event) => event.type), ["turn.started"]);
  assert.equal(finished, false);
  gate.resolve(); await run;
  assert.deepEqual(events.map((event) => event.type), ["turn.started", "message.received"]);
});

async function assertWorkflowSettlement({ rejectTerminal = false, rejectFirst = false } = {}) {
  const runId = "synthetic-ordered-run";
  const streamName = "synthetic-ordered-stream";
  const worldKey = Symbol.for("@workflow/world//cache");
  const previousWorld = globalThis[worldKey];
  const terminalStarted = deferred();
  const terminalWrite = deferred();
  const failure = new Error("Synthetic durable write failed");
  const events = [];
  const frames = [];
  let calls = 0;
  let closes = 0;
  globalThis[worldKey] = {
    streams: {
      async write(run, name, frame) {
        assert.equal(run, runId);
        assert.equal(name, streamName);
        const event = events[calls++];
        if (rejectFirst) throw failure;
        if (event.type === "message.completed") {
          terminalStarted.resolve();
          await terminalWrite.promise;
        }
        frames.push(Buffer.from(frame));
      },
      async close() { closes++; },
    },
  };
  const serialize = getSerializeStream(getExternalReducers(globalThis, [], runId, undefined), undefined);
  const writer = serialize.writable.getWriter();
  const flushState = createFlushableState();
  let drainFinished = false;
  flushState.promise.then(() => { drainFinished = true; }, () => { drainFinished = true; });
  const pipe = flushablePipe(serialize.readable, new WorkflowServerWritableStream(runId, streamName), flushState);
  pipe.catch(() => {});
  pollWritableLock(serialize.writable, flushState);
  let released = false;
  try {
    const run = candidate.emitStreamContent(async (event) => {
      events.push(event);
      await writer.write(protocol.encodeMessageStreamEvent(protocol.timestampHandleMessageStreamEvent(event)));
    }, state, parts([text("Synthetic answer"), finish]));

    if (rejectFirst) {
      await assert.rejects(run, (error) => error === failure);
      writer.releaseLock(); released = true;
      await assert.rejects(flushState.promise, (error) => error === failure);
      assert.equal(frames.length, 0);
      assert.equal(calls, 1);
    } else {
      await run;
      assert.equal(drainFinished, false, "Harness return cannot settle the owning step");
      writer.releaseLock(); released = true;
      await terminalStarted.promise;
      await microtasks();
      assert.equal(drainFinished, false, "Lock release cannot settle an unacknowledged write");
      assert.ok(flushState.pendingOps > 0);
      assert.equal(frames.length, 1);
      if (rejectTerminal) {
        terminalWrite.reject(failure);
        await assert.rejects(flushState.promise, (error) => error === failure);
        assert.equal(frames.length, 1);
      } else {
        terminalWrite.resolve();
        await flushState.promise;
        assert.equal(frames.length, 2);
        assert.equal(events.length, frames.length, "Each persisted event must remain one Workflow frame");
      }
    }
    assert.equal(closes, 0, "Parking must not close the shared conversation stream");
  } finally {
    terminalWrite.resolve();
    if (!released) writer.releaseLock();
    // Close only for test cleanup, after the real park-settlement assertions.
    if (rejectTerminal || rejectFirst) await serialize.writable.abort(failure).catch(() => {});
    else await serialize.writable.close().catch(() => {});
    await pipe.catch(() => {});
    if (previousWorld === undefined) delete globalThis[worldKey];
    else globalThis[worldKey] = previousWorld;
  }
}

await check("actual Workflow lock-release settlement awaits the terminal write without closing the stream", async () => {
  await assertWorkflowSettlement();
});

await check("actual Workflow drain rejects a terminal write failure after the harness returns", async () => {
  await assertWorkflowSettlement({ rejectTerminal: true });
});

await check("actual Workflow write failure rejects the harness and drops subsequent writes", async () => {
  await assertWorkflowSettlement({ rejectFirst: true });
});
