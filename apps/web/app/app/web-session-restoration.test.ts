import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  Client,
  type ClientSession,
  type HandleMessageStreamEvent,
  type SessionState,
} from "eve/client";

import {
  ACTIVE_WEB_BINDING_MS,
  latestTurnSequence,
  replayedMessageTimes,
  restoreServerBoundEveSession,
  webSessionBindingDecision,
} from "./web-session-restoration";

describe("web session binding restoration", () => {
  const now = Date.parse("2026-08-01T16:00:00.000Z");

  it("mints fresh only when the server has no same-day session", () => {
    assert.deepEqual(
      webSessionBindingDecision({
        binding: null,
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "fresh" },
    );
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "yesterday",
          lastSeenAtMs: Date.parse("2026-07-31T20:00:00.000Z"),
          latestSequence: 52,
          latestUserMessageAtMs: Date.parse("2026-07-31T20:00:01.000Z"),
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "fresh" },
    );
  });

  it("holds a fresh binding until another tab's possible turn is no longer fresh", () => {
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "live-session",
          lastSeenAtMs: now - 2_000,
          latestSequence: 61,
          latestUserMessageAtMs: now - 1_900,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "wait", delayMs: ACTIVE_WEB_BINDING_MS - 2_000 },
    );
  });

  it("resumes an inactive same-day binding", () => {
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "waiting-session",
          lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS,
          latestSequence: 61,
          latestUserMessageAtMs: now - ACTIVE_WEB_BINDING_MS + 100,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      {
        kind: "resume",
        sessionId: "waiting-session",
        targetSequence: 61,
      },
    );
  });

  it("keeps an exact local cursor without replaying the server session", () => {
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "waiting-session",
          lastSeenAtMs: now - 2_000,
          latestSequence: 61,
          latestUserMessageAtMs: now - 1_900,
        },
        current: {
          sessionId: "waiting-session",
          continuationToken: "continue-waiting-session",
          latestSequence: 61,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "current" },
    );
  });

  it("replays an exact tokenless cursor instead of authorizing a broken continuation", () => {
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "waiting-session",
          lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS,
          latestSequence: 61,
          latestUserMessageAtMs: now - ACTIVE_WEB_BINDING_MS + 100,
        },
        current: {
          sessionId: "waiting-session",
          latestSequence: 61,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      {
        kind: "resume",
        sessionId: "waiting-session",
        targetSequence: 61,
      },
    );
  });

  it("waits when a new binding has not reached canonical message storage", () => {
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "waiting-session",
          lastSeenAtMs: now - 2_000,
          latestSequence: 61,
          latestUserMessageAtMs: now - 10_000,
        },
        current: {
          sessionId: "waiting-session",
          latestSequence: 61,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "wait", delayMs: 5_000 },
    );
  });

  it("does not authorize an old local sequence from a binding-before-message snapshot", () => {
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "waiting-session",
          lastSeenAtMs: now - 2_000,
          latestSequence: 60,
          latestUserMessageAtMs: now - 10_000,
        },
        current: {
          sessionId: "waiting-session",
          latestSequence: 60,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "wait", delayMs: 5_000 },
    );
  });

  it("still waits after the active window when the canonical user witness is stale or missing", () => {
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "waiting-session",
          lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS - 60_000,
          latestSequence: 60,
          latestUserMessageAtMs: now - ACTIVE_WEB_BINDING_MS - 61_000,
        },
        current: {
          sessionId: "waiting-session",
          continuationToken: "stale-token",
          latestSequence: 60,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "wait", delayMs: 5_000 },
    );
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "waiting-session",
          lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS - 60_000,
          latestSequence: null,
          latestUserMessageAtMs: null,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "wait", delayMs: 5_000 },
    );
  });

  it("replays before send when the browser is nine turns behind", () => {
    assert.deepEqual(
      webSessionBindingDecision({
        binding: {
          runtimeSessionId: "carolyn-session",
          lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS,
          latestSequence: 61,
          latestUserMessageAtMs: now - ACTIVE_WEB_BINDING_MS + 100,
        },
        current: {
          sessionId: "carolyn-session",
          latestSequence: 52,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      {
        kind: "resume",
        sessionId: "carolyn-session",
        targetSequence: 61,
      },
    );
  });

  it("reads the latest durable turn sequence from a trimmed event cache", () => {
    const events = [
      { type: "turn.started", data: { sequence: 51, turnId: "turn-51" } },
      { type: "session.waiting", data: { wait: "next-user-message" } },
      { type: "turn.started", data: { sequence: 52, turnId: "turn-52" } },
      { type: "session.waiting", data: { wait: "next-user-message" } },
    ] as HandleMessageStreamEvent[];

    assert.equal(latestTurnSequence(events), 52);
    assert.equal(latestTurnSequence([]), null);
  });

  it("preserves durable replay times", () => {
    const events = [
      {
        type: "turn.started",
        data: { sequence: 52, turnId: "turn-52" },
        meta: { at: "2026-07-31T21:42:00.000Z" },
      },
      {
        type: "session.waiting",
        data: { wait: "next-user-message" },
        meta: { at: "2026-07-31T21:42:05.000Z" },
      },
      {
        type: "turn.started",
        data: { sequence: 53, turnId: "turn-53" },
        meta: { at: "2026-08-02T21:49:33.000Z" },
      },
      {
        type: "message.received",
        data: { sequence: 53, turnId: "turn-53", message: "BJJ" },
        meta: { at: "2026-08-02T21:49:33.556Z" },
      },
      {
        type: "message.completed",
        data: {
          finishReason: "stop",
          message: "Added BJJ to Monday.",
          sequence: 53,
          stepIndex: 1,
          turnId: "turn-53",
        },
        meta: { at: "2026-08-02T21:50:06.054Z" },
      },
      {
        type: "session.waiting",
        data: { wait: "next-user-message" },
        meta: { at: "2026-08-02T21:50:06.100Z" },
      },
    ] as HandleMessageStreamEvent[];

    assert.deepEqual(replayedMessageTimes(events), {
      "turn-53:user": Date.parse("2026-08-02T21:49:33.556Z"),
      "turn-53:assistant": Date.parse("2026-08-02T21:50:06.054Z"),
    });
  });

  it("replays the server session to its exact waiting cursor for display only", async () => {
    let state: SessionState = {
      sessionId: "waiting-session",
      streamIndex: 0,
    };
    const replayed = [
      {
        type: "turn.started",
        data: { sequence: 61, turnId: "turn-61" },
      },
      { type: "session.waiting", data: {} },
    ] as HandleMessageStreamEvent[];
    const session = {
      get state() {
        return state;
      },
      async *stream() {
        for (const event of replayed) yield event;
        state = { sessionId: "waiting-session", streamIndex: replayed.length };
      },
    } as unknown as ClientSession;
    const client = {
      session() {
        return session;
      },
    } as Pick<Client, "session">;
    const bindingResponse = () =>
      Response.json({
        ok: true,
        binding: {
          runtimeSessionId: "waiting-session",
          lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS,
          latestSequence: 61,
          latestUserMessageAtMs: now - ACTIVE_WEB_BINDING_MS + 100,
        },
      });

    const restored = await restoreServerBoundEveSession({
      client,
      current: {
        sessionId: "waiting-session",
        continuationToken: "continue-waiting-session",
        latestSequence: 52,
      },
      timeZone: "America/New_York",
      signal: new AbortController().signal,
      fetcher: async () => bindingResponse(),
      now: () => now,
    });

    assert.deepEqual(restored, {
      kind: "replayed",
      runtimeSessionId: "waiting-session",
      events: replayed,
    });
  });

  it("rechecks the binding after replay and follows a newer durable turn", async () => {
    let bindingReads = 0;
    let replayReads = 0;
    const client = {
      session() {
        replayReads += 1;
        const sequence = replayReads === 1 ? 61 : 62;
        return {
          async *stream() {
            yield {
              type: "turn.started",
              data: { sequence, turnId: `turn-${sequence}` },
            } as HandleMessageStreamEvent;
            yield {
              type: "session.waiting",
              data: { wait: "next-user-message" },
            } as HandleMessageStreamEvent;
          },
        } as unknown as ClientSession;
      },
    } as Pick<Client, "session">;

    const restored = await restoreServerBoundEveSession({
      client,
      current: {
        sessionId: "waiting-session",
        continuationToken: "stale-token",
        latestSequence: 52,
      },
      timeZone: "America/New_York",
      signal: new AbortController().signal,
      fetcher: async () => {
        bindingReads += 1;
        const latestSequence = bindingReads === 1 ? 61 : 62;
        return Response.json({
          ok: true,
          binding: {
            runtimeSessionId: "waiting-session",
            lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS,
            latestSequence,
            latestUserMessageAtMs:
              now - ACTIVE_WEB_BINDING_MS + 100,
          },
        });
      },
      now: () => now,
    });

    assert.equal(restored?.kind, "replayed");
    if (restored?.kind !== "replayed") return;
    assert.equal(latestTurnSequence(restored.events), 62);
    assert.equal(replayReads, 2);
    assert.equal(bindingReads, 4);
  });

  it("stops a live Eve stream at the target boundary without reusing a stale continuation token", async () => {
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    let streamCancelled = false;
    let continuedBody: unknown = null;
    const events = [
      {
        type: "turn.started",
        data: { sequence: 60, turnId: "turn-60" },
      },
      { type: "session.waiting", data: { wait: "next-user-message" } },
      {
        type: "turn.started",
        data: { sequence: 61, turnId: "turn-61" },
      },
      { type: "session.waiting", data: { wait: "next-user-message" } },
      {
        type: "turn.started",
        data: { sequence: 62, turnId: "turn-62" },
      },
    ] as HandleMessageStreamEvent[];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`${events.map((event) => JSON.stringify(event)).join("\n")}\n`),
        );
      },
      cancel() {
        streamCancelled = true;
      },
    });
    globalThis.fetch = (async (_input, init) => {
      if (init?.method === "POST") {
        continuedBody = JSON.parse(String(init.body));
        return Response.json({ ok: true, sessionId: "waiting-session" });
      }
      return new Response(stream, { status: 200 });
    }) as typeof fetch;

    try {
      const client = new Client({ host: "https://homa.test" });
      const restored = await restoreServerBoundEveSession({
        client,
        current: {
          sessionId: "waiting-session",
          continuationToken: "continue-waiting-session",
          latestSequence: 52,
        },
        timeZone: "America/New_York",
        signal: AbortSignal.timeout(2_000),
        fetcher: async () =>
          Response.json({
            ok: true,
            binding: {
              runtimeSessionId: "waiting-session",
              lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS,
              latestSequence: 61,
              latestUserMessageAtMs:
                now - ACTIVE_WEB_BINDING_MS + 100,
            },
          }),
        now: () => now,
      });

      assert.equal(restored?.kind, "replayed");
      if (restored?.kind !== "replayed") return;
      assert.equal(restored.events.length, 4);
      assert.equal(streamCancelled, true);
      assert.equal("session" in restored, false);
      assert.equal(continuedBody, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("surfaces a parked authorization prompt from a stream that never reaches waiting", async () => {
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    let streamCancelled = false;
    const events = [
      {
        type: "turn.started",
        data: { sequence: 61, turnId: "turn-61" },
      },
      {
        type: "authorization.required",
        data: {
          name: "calendar",
          sequence: 61,
          stepIndex: 0,
          turnId: "turn-61",
          authorization: { url: "https://homa.test/connect" },
        },
      },
    ] as HandleMessageStreamEvent[];
    globalThis.fetch = (async (_request, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
            ),
          );
          init?.signal?.addEventListener("abort", () => {
            streamCancelled = true;
            controller.error(new DOMException("Aborted", "AbortError"));
          });
        },
        cancel() {
          streamCancelled = true;
        },
      });
      return new Response(stream, { status: 200 });
    }) as typeof fetch;

    try {
      const client = new Client({ host: "https://homa.test" });
      const restored = await restoreServerBoundEveSession({
        client,
        current: {
          sessionId: "waiting-session",
          continuationToken: "stale-token",
          latestSequence: 52,
        },
        timeZone: "America/New_York",
        signal: AbortSignal.timeout(2_000),
        fetcher: async () =>
          Response.json({
            ok: true,
            binding: {
              runtimeSessionId: "waiting-session",
              lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS,
              latestSequence: 61,
              latestUserMessageAtMs:
                now - ACTIVE_WEB_BINDING_MS + 100,
            },
          }),
        now: () => now,
      });

      assert.equal(restored?.kind, "parked");
      if (restored?.kind !== "parked") return;
      assert.deepEqual(restored.events, events);
      assert.equal(streamCancelled, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("bounds a persistent binding route failure", async () => {
    let reads = 0;
    const restored = await restoreServerBoundEveSession({
      client: {
        session() {
          throw new Error("should not replay");
        },
      } as Pick<Client, "session">,
      timeZone: "America/New_York",
      signal: new AbortController().signal,
      fetcher: async () => {
        reads += 1;
        return new Response(null, { status: 503 });
      },
      sleep: async () => {},
    });

    assert.deepEqual(restored, { kind: "unavailable" });
    assert.equal(reads, 3);
  });
});
