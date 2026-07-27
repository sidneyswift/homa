import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseOffsetIsoTimestampEpochNanoseconds } from "../child-progress/timestamp";
import { lessonObservedAt } from "./observed-at";

describe("lessonObservedAt", () => {
  it("normalizes the Postgres text form the journal parser rejects", () => {
    // The exact prod value that failed lesson 578edf91's re-analysis on
    // 2026-07-21: space separator, microseconds, short "+00" offset.
    const normalized = lessonObservedAt("2026-07-21 16:23:42.081217+00");
    assert.equal(normalized, "2026-07-21T16:23:42.081Z");
    // The whole point: the strict journal parser must accept the result.
    parseOffsetIsoTimestampEpochNanoseconds(normalized);
  });

  it("passes an already-strict ISO timestamp through unchanged in value", () => {
    const normalized = lessonObservedAt("2026-07-21T16:23:42.081Z");
    assert.equal(normalized, "2026-07-21T16:23:42.081Z");
    parseOffsetIsoTimestampEpochNanoseconds(normalized);
  });

  it("falls back to now for null and for garbage", () => {
    for (const value of [null, "not a date"]) {
      const normalized = lessonObservedAt(value);
      parseOffsetIsoTimestampEpochNanoseconds(normalized);
      const ageMs = Date.now() - new Date(normalized).getTime();
      assert.ok(ageMs >= 0 && ageMs < 5_000);
    }
  });
});
