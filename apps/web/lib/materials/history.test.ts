import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toVersionHistory } from "./history";

/**
 * Version history (gh#350). "As soon as she redoes it I can't see the old
 * version, so I have to start screenshotting."
 */

function row(
  id: string,
  revises: string | null,
  day: number,
  status: "draft" | "final" | "superseded" = "superseded",
  previewUrl: string | null = `https://example.test/${id}.jpg`,
) {
  return {
    id,
    revises,
    preview_url: previewUrl,
    created_at: new Date(Date.UTC(2026, 6, day, 12)).toISOString(),
    status,
  };
}

describe("toVersionHistory", () => {
  it("returns the whole chain oldest first, numbered the way she made them", () => {
    const history = toVersionHistory(
      [row("c", "b", 3, "final"), row("a", null, 1), row("b", "a", 2)],
      "c",
    );
    assert.deepEqual(
      history.map((entry) => [entry.ordinal, entry.id]),
      [
        [1, "a"],
        [2, "b"],
        [3, "c"],
      ],
    );
  });

  it("marks which version is the one she is looking at", () => {
    const history = toVersionHistory([row("a", null, 1), row("b", "a", 2, "final")], "a");
    assert.deepEqual(
      history.map((entry) => entry.isCurrent),
      [true, false],
    );
  });

  it("walks upward too, so opening the newest still shows the whole chain", () => {
    const history = toVersionHistory(
      [row("a", null, 1), row("b", "a", 2), row("c", "b", 3, "final")],
      "a",
    );
    assert.equal(history.length, 3);
  });

  it("keeps a version whose image was reclaimed, rather than hiding that it existed", () => {
    const history = toVersionHistory(
      [row("a", null, 1, "superseded", null), row("b", "a", 2, "final")],
      "b",
    );
    assert.equal(history.length, 2);
    assert.equal(history[0].previewUrl, null);
  });

  it("treats a blank url the same as a missing one", () => {
    const history = toVersionHistory([row("a", null, 1, "final", "   ")], "a");
    assert.equal(history[0].previewUrl, null);
  });

  it("never mixes in another chain's versions", () => {
    const history = toVersionHistory(
      [row("a", null, 1), row("b", "a", 2, "final"), row("x", null, 3, "final")],
      "a",
    );
    assert.deepEqual(history.map((entry) => entry.id), ["a", "b"]);
  });

  it("returns a single-version material as a chain of one", () => {
    const history = toVersionHistory([row("only", null, 1, "final")], "only");
    assert.deepEqual(history.map((entry) => entry.ordinal), [1]);
  });
});
