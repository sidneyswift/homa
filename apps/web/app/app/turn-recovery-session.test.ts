import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sessionStateAfterRecoveredBoundary } from "./turn-recovery";

describe("recovered Eve boundary cursor", () => {
  it("continues a waiting conversation after the recovered boundary", () => {
    assert.deepEqual(
      sessionStateAfterRecoveredBoundary({
        boundary: "session.waiting",
        sessionId: "session-recovered",
        streamIndex: 23,
      }),
      { sessionId: "session-recovered", streamIndex: 23 },
    );
  });

  it("starts fresh after a completed session", () => {
    assert.deepEqual(
      sessionStateAfterRecoveredBoundary({
        boundary: "session.completed",
        sessionId: "session-closed",
        streamIndex: 23,
      }),
      { streamIndex: 0 },
    );
  });
});
