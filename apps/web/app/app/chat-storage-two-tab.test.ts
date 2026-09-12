import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";

import type { HandleMessageStreamEvent } from "eve/client";

import { shouldAdoptSavedSession, withChatTurnLock } from "./chat-session-cache";
import { mergeSavedSessionEvents, type SavedChat } from "./chat-storage";

function events(from: number, to: number): HandleMessageStreamEvent[] {
  return Array.from({ length: to - from }, (_, index) => ({
    type: "turn.started",
    data: { turnId: `event-${from + index}` },
  })) as HandleMessageStreamEvent[];
}

function snapshot(start: number, end: number): SavedChat {
  return {
    events: events(start, end),
    session: {
      sessionId: "shared-session",
      streamIndex: end,
    },
    messageTimes: { [`message-${end}`]: end },
    lastActivityAt: end,
  };
}

function mockNavigatorLocks(t: TestContext, locks: unknown): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { locks },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "navigator", previous);
    else Reflect.deleteProperty(globalThis, "navigator");
  });
}

function capturePreparation(t: TestContext): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  t.mock.method(console, "info", (prefix: unknown, value: unknown) => {
    assert.equal(prefix, "[chat-preparation]");
    records.push(JSON.parse(String(value)) as Record<string, unknown>);
  });
  return records;
}

describe("chat turn lock observation", () => {
  it("ends the wait at acquisition while holding the lock for the full operation", async (t) => {
    const records = capturePreparation(t);
    let clock = 10;
    t.mock.method(performance, "now", () => clock);
    const ready = Promise.withResolvers<void>();
    const finished = Promise.withResolvers<string>();
    let lockName: string | undefined;
    let calls = 0;
    mockNavigatorLocks(t, {
      request: async (name: string, operation: () => Promise<unknown>) => {
        lockName = name;
        await ready.promise;
        return await operation();
      },
    });

    const pending = withChatTurnLock("private-adult-key", async () => {
      calls += 1;
      return await finished.promise;
    }, "send");
    assert.equal(calls, 0);
    assert.equal(records.length, 0);
    clock = 50;
    ready.resolve();
    await Promise.resolve();
    assert.equal(calls, 1);
    assert.equal(lockName, "homa-chat-turn:private-adult-key");
    assert.equal(records.length, 1);
    assert.equal(records[0].durationMs, 40);
    assert.equal(records[0].stage, "session_lock_wait");
    assert.equal(records[0].source, "send");
    assert.equal(records[0].outcome, "ok");
    assert.equal(typeof records[0].startedAtMs, "number");
    clock = 900;
    finished.resolve("private-message-and-continuation-token");
    assert.equal(await pending, "private-message-and-continuation-token");
    assert.equal(records.length, 1);
    assert.equal(records[0].durationMs, 40);
    assert.doesNotMatch(JSON.stringify(records), /private|token/u);
  });

  it("preserves an aborted acquisition without invoking the operation or logging the error", async (t) => {
    const records = capturePreparation(t);
    const cancellation = new DOMException("private-session-token", "AbortError");
    let calls = 0;
    mockNavigatorLocks(t, {
      request: async () => { throw cancellation; },
    });
    await assert.rejects(withChatTurnLock("private-adult-key", async () => {
      calls += 1;
    }, "restore"), (error) => error === cancellation);
    assert.equal(calls, 0);
    assert.equal(records.length, 1);
    assert.equal(records[0].outcome, "error");
    assert.equal(records[0].source, "restore");
    assert.doesNotMatch(JSON.stringify(records), /private|token|AbortError/u);
  });

  it("propagates operation failure after acquisition with one successful wait record", async (t) => {
    const records = capturePreparation(t);
    const failure = new Error("private-operation-payload");
    mockNavigatorLocks(t, {
      request: async (_name: string, operation: () => Promise<unknown>) => await operation(),
    });
    await assert.rejects(withChatTurnLock("private-adult-key", async () => {
      throw failure;
    }, "send"), (error) => error === failure);
    assert.equal(records.length, 1);
    assert.equal(records[0].outcome, "ok");
    assert.doesNotMatch(JSON.stringify(records), /private|payload/u);
  });

  it("keeps the no-Web-Locks fallback and tolerates unavailable logging", async (t) => {
    mockNavigatorLocks(t, undefined);
    t.mock.method(console, "info", () => { throw new Error("logging unavailable"); });
    let calls = 0;
    assert.equal(await withChatTurnLock("private-adult-key", async () => {
      calls += 1;
      return "unchanged-result";
    }, "send"), "unchanged-result");
    assert.equal(calls, 1);
  });
});

describe("two-tab chat cache", () => {
  it("adopts another tab's completed cursor before sending", () => {
    assert.equal(
      shouldAdoptSavedSession(
        { sessionId: "stale-session", streamIndex: 12 },
        { sessionId: "current-session", streamIndex: 4 },
      ),
      true,
    );
    assert.equal(
      shouldAdoptSavedSession(
        { sessionId: "shared-session", streamIndex: 12 },
        { sessionId: "shared-session", streamIndex: 18 },
      ),
      true,
    );
    assert.equal(
      shouldAdoptSavedSession(
        { sessionId: "shared-session", streamIndex: 18 },
        { sessionId: "shared-session", streamIndex: 12 },
      ),
      false,
    );
  });

  it("joins a second tab's tail onto the first tab's event log", () => {
    const merged = mergeSavedSessionEvents(snapshot(0, 10), snapshot(10, 15));

    assert.equal(merged.session?.streamIndex, 15);
    assert.equal(merged.events?.length, 15);
    assert.deepEqual(
      (merged.events ?? []).map((event) =>
        event.type === "turn.started" ? event.data.turnId : null,
      ),
      Array.from({ length: 15 }, (_, index) => `event-${index}`),
    );
  });

  it("does not let the older tab clobber a cursor already advanced elsewhere", () => {
    const current = snapshot(0, 15);
    const staleWrite = snapshot(0, 10);
    const merged = mergeSavedSessionEvents(current, staleWrite);

    assert.equal(merged.session?.streamIndex, 15);
    assert.equal(merged.events?.length, 15);
    assert.deepEqual(merged.messageTimes, {
      "message-15": 15,
      "message-10": 10,
    });
  });
});
