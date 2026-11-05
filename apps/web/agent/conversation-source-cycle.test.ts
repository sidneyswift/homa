import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import type { HandleMessageStreamEvent } from "eve/client";

import { runConversationSourceWindow, runConversationSourceCycle, type ConversationSourceCycleDependencies } from "./conversation-source-cycle";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const source = { sessionId: "session", requestId: "request", conversationId: "conversation", familyId: "family",
    memberUserId: "adult", accessEpoch: "epoch", leaseToken: "lease", nextIndex: 8 };
  const calls: string[] = [];
  const dependencies: ConversationSourceCycleDependencies = {
    enabled: () => true, lease: async () => [source],
    apply: async (_, index, events) => { calls.push(`apply:${index}`); return { nextIndex: index + events.length, complete: false, messageId: null }; },
    release: async () => { calls.push("release"); }, passMs: 30, cleanupMs: 10, batchSize: 1,
  };
  return { source, calls, dependencies };
}
const event = { type: "message.appended", data: { messageDelta: "word", messageSoFar: "word", sequence: 0, stepIndex: 0, turnId: "turn" } } as HandleMessageStreamEvent;
function streamOf(events: HandleMessageStreamEvent[]) {
  return new ReadableStream<HandleMessageStreamEvent>({ start(controller) {
    for (const value of events) controller.enqueue(value);
    controller.close();
  } });
}

test("disabled recording never leases or opens streams", async () => {
  const f = fixture(); f.dependencies.enabled = () => false;
  f.dependencies.lease = async () => assert.fail();
  assert.deepEqual(await runConversationSourceCycle(async () => assert.fail(), f.dependencies), { sources: 0, events: 0, retrying: 0 });
});

test("source bookmarks advance only after each successful transaction", async () => {
  const f = fixture();
  const result = await runConversationSourceCycle(async (session, index) => {
    assert.equal(session, f.source.sessionId); assert.equal(index, 8); return streamOf([event, event]);
  }, f.dependencies);
  assert.deepEqual(f.calls, ["apply:8", "apply:9", "release"]);
  assert.deepEqual(result, { sources: 1, events: 2, retrying: 0 });
});

test("an opening that never resolves returns within the pass deadline", async () => {
  const f = fixture();
  const result = await runConversationSourceCycle(() => new Promise(() => {}), f.dependencies);
  assert.deepEqual(result, { sources: 0, events: 0, retrying: 1 });
  assert.deepEqual(f.calls, ["release"]);
});

test("a late opened stream is cancelled without a reader or content consumption", async () => {
  const f = fixture(), opening = deferred<ReadableStream<HandleMessageStreamEvent>>();
  await runConversationSourceCycle(() => opening.promise, f.dependencies);
  let cancelled = 0;
  const late = new ReadableStream<HandleMessageStreamEvent>({ cancel() { cancelled++; } }, { highWaterMark: 0 });
  late.getReader = () => assert.fail("a timed out open must not acquire a reader");
  opening.resolve(late); await setImmediate();
  assert.equal(cancelled, 1); assert.deepEqual(f.calls, ["release"]);
});

test("hung reads and hung stream cancellation cannot pin a lease", async () => {
  const f = fixture();
  const result = await runConversationSourceCycle(async () => new ReadableStream<HandleMessageStreamEvent>({
    cancel: () => new Promise(() => {}),
  }), f.dependencies);
  assert.deepEqual(result, { sources: 0, events: 0, retrying: 1 });
  assert.deepEqual(f.calls, ["release"]);
});

test("a transaction timeout neither advances a bookmark nor releases its fence", async () => {
  const f = fixture(), write = deferred<{ nextIndex: number; complete: boolean; messageId: null }>();
  f.dependencies.apply = async (_, index) => { f.calls.push(`apply:${index}`); return write.promise; };
  const result = await runConversationSourceCycle(async () => streamOf([event, event]), f.dependencies);
  assert.deepEqual(result, { sources: 0, events: 0, retrying: 1 });
  assert.deepEqual(f.calls, ["apply:8"]);
  // The real transaction can still commit. Recovery reads its persisted cursor;
  // this finished pass never guesses a second event or changes its result later.
  write.resolve({ nextIndex: 9, complete: false, messageId: null }); await setImmediate();
  assert.deepEqual(f.calls, ["apply:8"]); assert.equal(result.events, 0);
});

test("a failed write retains earlier committed progress and does not consume later events", async () => {
  const f = fixture();
  f.dependencies.apply = async (_, index) => {
    f.calls.push(`apply:${index}`);
    if (index === 9) throw new Error("write failed");
    return { nextIndex: 9, complete: false, messageId: null };
  };
  const result = await runConversationSourceCycle(async () => streamOf([event, event, event]), f.dependencies);
  assert.deepEqual(f.calls, ["apply:8", "apply:9"]);
  assert.deepEqual(result, { sources: 0, events: 1, retrying: 1 });
});

test("lease cleanup failure is bounded and reported as retrying", async () => {
  const f = fixture(); f.dependencies.release = () => new Promise(() => {});
  const result = await runConversationSourceCycle(async () => streamOf([]), f.dependencies);
  assert.deepEqual(result, { sources: 1, events: 0, retrying: 1 });
});

test("late lease acquisition releases only those exact leases without opening streams", async () => {
  const f = fixture(), leased = deferred<typeof f.source[]>();
  f.dependencies.lease = () => leased.promise;
  const result = await runConversationSourceCycle(async () => assert.fail(), f.dependencies);
  assert.deepEqual(result, { sources: 0, events: 0, retrying: 1 });
  leased.resolve([f.source]); await setImmediate();
  assert.deepEqual(f.calls, ["release"]);
});

test("one stalled source does not prevent another source from committing", async () => {
  const f = fixture(); f.dependencies.lease = async () => [f.source, { ...f.source, sessionId: "healthy" }];
  const result = await runConversationSourceCycle(async session => session === "healthy" ? streamOf([event]) : new Promise(() => {}), f.dependencies);
  assert.deepEqual(result, { sources: 1, events: 1, retrying: 1 });
  assert.equal(f.calls.filter(call => call === "release").length, 2);
});

test("a terminal source batch closes without applying buffered later events", async () => {
  const f = fixture(); f.dependencies.apply = async (_, index) => {
    f.calls.push(`apply:${index}`); return { nextIndex: index + 1, complete: true, messageId: null };
  };
  const result = await runConversationSourceCycle(async () => streamOf([event, event]), f.dependencies);
  assert.deepEqual(result, { sources: 1, events: 1, retrying: 0 });
  assert.deepEqual(f.calls, ["apply:8", "release"]);
});

test("bounded batches keep all source indices while reducing commit overhead", async () => {
  const f = fixture(); f.dependencies.batchSize = 64; f.dependencies.passMs = 200;
  const sizes: number[] = [];
  f.dependencies.apply = async (_, index, events) => {
    sizes.push(events.length); f.calls.push(`apply:${index}`);
    return { nextIndex: index + events.length, complete: false, messageId: null };
  };
  const result = await runConversationSourceCycle(async () => streamOf(Array.from({ length: 130 }, () => event)), f.dependencies);
  assert.deepEqual(sizes, [64,64,2]);
  assert.deepEqual(f.calls, ["apply:8","apply:72","apply:136","release"]);
  assert.equal(result.events, 130);
});

test("a read crossing the batch flush remains available for the next commit", async () => {
  const f = fixture(); f.dependencies.batchSize = 64; f.dependencies.passMs = 200;
  const values: HandleMessageStreamEvent[] = [];
  f.dependencies.apply = async (_, index, events) => {
    values.push(...events); return { nextIndex: index + events.length, complete: false, messageId: null };
  };
  const result = await runConversationSourceCycle(async () => new ReadableStream({ start(controller) {
    controller.enqueue(event);
    setTimeout(() => { controller.enqueue(event); controller.close(); }, 25);
  } }), f.dependencies);
  assert.equal(values.length, 2); assert.equal(result.events, 2);
});


test("recording window continues between sweeps but stops once no work can be leased", async () => {
  let passes = 0;
  const result = await runConversationSourceWindow(async () => { throw new Error("cycle stub owns stream"); }, async () => {
    passes++;
    return passes === 1 ? { sources: 0, events: 30, retrying: 1 } : { sources: 0, events: 0, retrying: 0 };
  });
  assert.equal(passes, 2); assert.equal(result.events, 30);
  passes = 0;
  await runConversationSourceWindow(async () => { throw new Error("cycle stub owns stream"); }, async () => {
    passes++; return { sources: 0, events: 10, retrying: 1 };
  });
  assert.equal(passes, 3, "an active stream never creates an unbounded function");
});
