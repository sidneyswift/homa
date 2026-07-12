import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatchContinuationToken } from "./dispatch-session-token";

const FAMILY = "304f0003-6c55-4c31-807a-941aff214283";
const NOW = new Date("2026-07-12T10:00:33.000Z");

describe("dispatch continuation token", () => {
  it("gives two custom runs for one family on one day distinct sessions", () => {
    // The 2026-07-12 production incident: three per-kid custom briefs in
    // one tick collided on one token and eve rejected two sessions with
    // HookConflictError. Distinct runs must never share a token.
    const first = dispatchContinuationToken(
      "custom",
      FAMILY,
      "9e7e868d-c752-46b0-acbe-d192866e3fd1",
      NOW,
    );
    const second = dispatchContinuationToken(
      "custom",
      FAMILY,
      "5ee6aa38-f4e0-46dc-8315-746c182add04",
      NOW,
    );

    assert.notEqual(first, second);
  });

  it("stays stable when the same run is redelivered", () => {
    const runId = "9e7e868d-c752-46b0-acbe-d192866e3fd1";

    assert.equal(
      dispatchContinuationToken("custom", FAMILY, runId, NOW),
      dispatchContinuationToken("custom", FAMILY, runId, NOW),
    );
  });

  it("keeps kinds apart for the same family", () => {
    assert.notEqual(
      dispatchContinuationToken("morning_brief", FAMILY, "run-a", NOW),
      dispatchContinuationToken("journal_prompt", FAMILY, "run-a", NOW),
    );
  });

  it("falls back to a day-scoped token when no run id exists", () => {
    const token = dispatchContinuationToken("custom", FAMILY, null, NOW);

    assert.ok(token.includes(FAMILY));
    assert.ok(token.includes("2026-07-12"));
  });
});
