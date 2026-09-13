import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultMessageReducer,
  EveAgentStore,
  type ClientSession,
  type HandleMessageStreamEvent,
} from "eve/client";

import { createTurnBoundaryWatchdog } from "./turn-boundary-watchdog";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function settleAsyncWork(): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await Promise.resolve();
  }
}

describe("turn boundary watchdog", () => {
  it("recovers a durable boundary when the live stream goes silent", async () => {
    const recovery = deferred<string | null>();
    const recovered: string[] = [];
    let probes = 0;
    const watchdog = createTurnBoundaryWatchdog({
      stallMs: 30_000,
      probe: () => {
        probes += 1;
        return recovery.promise;
      },
      onRecovered: (value) => recovered.push(value),
    });

    watchdog.begin(1_000);
    watchdog.check(30_999);
    assert.equal(probes, 0);
    watchdog.check(31_000);
    assert.equal(probes, 1);
    watchdog.check(90_000);
    assert.equal(probes, 1);

    recovery.resolve("session.waiting");
    await recovery.promise;
    await Promise.resolve();
    assert.deepEqual(recovered, ["session.waiting"]);
  });

  it("cancels a probe as soon as the primary stream shows life", async () => {
    const recovery = deferred<string | null>();
    const recovered: string[] = [];
    const probeSignal = { current: null as AbortSignal | null };
    const watchdog = createTurnBoundaryWatchdog({
      stallMs: 30_000,
      probe: (signal) => {
        probeSignal.current = signal;
        return recovery.promise;
      },
      onRecovered: (value) => recovered.push(value),
    });

    watchdog.begin(0);
    watchdog.check(30_000);
    watchdog.noteActivity(31_000);
    assert.equal(probeSignal.current?.aborted, true);

    recovery.resolve("late-boundary");
    await recovery.promise;
    await Promise.resolve();
    assert.deepEqual(recovered, []);
  });

  it("backs off after an inconclusive probe instead of opening a stream loop", async () => {
    let probes = 0;
    const watchdog = createTurnBoundaryWatchdog({
      stallMs: 30_000,
      probe: async () => {
        probes += 1;
        return null;
      },
      onRecovered: () => assert.fail("an inconclusive probe cannot recover"),
    });

    watchdog.begin(0);
    watchdog.check(30_000);
    await Promise.resolve();
    watchdog.check(30_001);
    assert.equal(probes, 1);
    watchdog.check(60_000);
    assert.equal(probes, 2);
  });

  it("releases an Eve store whose primary stream stays open past a durable boundary", async () => {
    const primarySignal = { current: null as AbortSignal | null };
    const session = {
      get state() {
        return { sessionId: "session-stalled", streamIndex: 1 };
      },
      async send(input: { signal?: AbortSignal }) {
        primarySignal.current = input.signal ?? null;
        const signal = input.signal;
        return {
          async *[Symbol.asyncIterator]() {
            yield {
              data: {},
              type: "session.started",
              meta: { at: "2026-09-13T00:00:00.000Z", ...{ id: "fixture-started-event" } },
            } satisfies HandleMessageStreamEvent;
            await new Promise<void>((resolve) => {
              if (!signal || signal.aborted) {
                resolve();
                return;
              }
              signal.addEventListener("abort", () => resolve(), { once: true });
            });
          },
        };
      },
    } as unknown as ClientSession;
    const store = new EveAgentStore({
      reducer: defaultMessageReducer(),
      session,
    });
    const sendPromise = store.send({ message: "hello" });
    await settleAsyncWork();
    assert.equal(store.snapshot.status, "streaming");

    const recovered: string[] = [];
    const watchdog = createTurnBoundaryWatchdog({
      stallMs: 30_000,
      probe: async () => "session.waiting",
      onRecovered: (boundary) => {
        recovered.push(boundary);
        store.reset();
      },
    });
    watchdog.begin(0);
    watchdog.check(30_000);
    await settleAsyncWork();
    await sendPromise;

    assert.deepEqual(recovered, ["session.waiting"]);
    assert.equal(primarySignal.current?.aborted, true);
    assert.equal(store.snapshot.status, "ready");
  });
});
