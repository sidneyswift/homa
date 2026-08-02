import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  Client,
  ClientSession,
  HandleMessageStreamEvent,
  SessionState,
} from "eve/client";

import {
  ACTIVE_WEB_BINDING_MS,
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
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "resume", sessionId: "waiting-session" },
    );
  });

  it("replays the server session to its exact waiting cursor before adoption", async () => {
    let state: SessionState = {
      sessionId: "waiting-session",
      streamIndex: 0,
    };
    const replayed = [
      { type: "turn.started", data: { turnId: "turn-1" } },
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
    const response = Response.json({
      ok: true,
      binding: {
        runtimeSessionId: "waiting-session",
        lastSeenAtMs: now - ACTIVE_WEB_BINDING_MS,
      },
    });

    const restored = await restoreServerBoundEveSession({
      client,
      timeZone: "America/New_York",
      signal: new AbortController().signal,
      fetcher: async () => response,
      now: () => now,
    });

    assert.deepEqual(restored, {
      kind: "resumed",
      events: replayed,
      session: { sessionId: "waiting-session", streamIndex: replayed.length },
    });
  });
});
