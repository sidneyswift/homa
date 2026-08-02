import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type {
  Client,
  ClientSession,
  HandleMessageStreamEvent,
  SessionState,
} from "eve/client";

import {
  ACTIVE_MOBILE_BINDING_MS,
  mobileSessionBindingDecision,
  restoreServerBoundMobileSession,
} from "./session-binding";

describe("mobile session binding restoration", () => {
  const now = Date.parse("2026-08-01T16:00:00.000Z");

  it("mints fresh only when the authenticated server binding is absent or from another chat day", () => {
    assert.deepEqual(
      mobileSessionBindingDecision({
        binding: null,
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "fresh" },
    );
    assert.deepEqual(
      mobileSessionBindingDecision({
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

  it("waits for a possibly active cross-surface turn", () => {
    assert.deepEqual(
      mobileSessionBindingDecision({
        binding: {
          runtimeSessionId: "active-session",
          lastSeenAtMs: now - 2_000,
        },
        nowMs: now,
        timeZone: "America/New_York",
      }),
      { kind: "wait", delayMs: ACTIVE_MOBILE_BINDING_MS - 2_000 },
    );
  });

  it("uses mobile bearer auth and replays a waiting session to its exact cursor", async () => {
    let state: SessionState = { sessionId: "waiting-session", streamIndex: 0 };
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
    const client = { session: () => session } as Pick<Client, "session">;
    let requestUrl = "";
    let authorization: string | null = null;

    const restored = await restoreServerBoundMobileSession({
      client,
      apiOrigin: "https://homa.test",
      bearer: async () => "access-token",
      timeZone: "America/New_York",
      signal: new AbortController().signal,
      fetcher: async (input, init) => {
        requestUrl = String(input);
        authorization = new Headers(init?.headers).get("authorization");
        return Response.json({
          ok: true,
          binding: {
            runtimeSessionId: "waiting-session",
            lastSeenAtMs: now - ACTIVE_MOBILE_BINDING_MS,
          },
        });
      },
      now: () => now,
    });

    assert.equal(requestUrl, "https://homa.test/api/chat/session-binding");
    assert.equal(authorization, "Bearer access-token");
    assert.deepEqual(restored, {
      kind: "resumed",
      events: replayed,
      session: { sessionId: "waiting-session", streamIndex: replayed.length },
    });
  });

  it("keeps the session-binding route bearer-aware and server-scoped", async () => {
    const source = await readFile(
      new URL("../../../web/app/api/chat/session-binding/route.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /resolveApiFamily\(request\)/u);
    assert.doesNotMatch(source, /requireFamilyWithActor/u);
  });

  it("wires bounded history before restoration and remounts on the restored cursor", async () => {
    const source = await readFile(
      new URL("../app/(tabs)/chat.tsx", import.meta.url),
      "utf8",
    );
    const historyAt = source.indexOf("await fetchMobileChatHistory");
    const restorationAt = source.indexOf("await restoreServerBoundMobileSession");
    assert.ok(historyAt >= 0);
    assert.ok(restorationAt > historyAt);
    assert.doesNotMatch(source, /Promise\.all/u);
    assert.match(source, /key=\{`\$\{userId\}:\$\{chatSessionKey\}`\}/u);
  });
});
