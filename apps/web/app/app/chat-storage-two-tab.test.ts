import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HandleMessageStreamEvent } from "eve/client";

import { shouldAdoptSavedSession } from "./chat-session-cache";
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
