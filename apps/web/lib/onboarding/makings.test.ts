import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowanceForWeek,
  predictedLockoutAt,
  refillWindow,
  weeksSince,
} from "./makings";

describe("allowanceForWeek", () => {
  it("is generous for the first two weeks, then steady", () => {
    assert.equal(allowanceForWeek(0), 10);
    assert.equal(allowanceForWeek(1), 10);
    assert.equal(allowanceForWeek(2), 3);
    assert.equal(allowanceForWeek(9), 3);
  });

  it("never returns less than the first week for a nonsense index", () => {
    assert.equal(allowanceForWeek(-1), 10);
  });
});

describe("refillWindow", () => {
  it("runs Monday to Monday, whatever day it is asked", () => {
    // 2026-07-21 is a Tuesday.
    const { startsAt, refillsAt } = refillWindow(new Date("2026-07-21T18:30:00Z"));
    assert.equal(startsAt.toISOString(), "2026-07-20T00:00:00.000Z");
    assert.equal(refillsAt.toISOString(), "2026-07-27T00:00:00.000Z");
  });

  it("puts Sunday at the END of its week, not the start", () => {
    // The off-by-one that would give a parent a fresh allowance on
    // Sunday night and take it away again on Monday morning.
    const { startsAt } = refillWindow(new Date("2026-07-26T23:00:00Z"));
    assert.equal(startsAt.toISOString(), "2026-07-20T00:00:00.000Z");
  });

  it("treats Monday itself as the start of its own week", () => {
    const { startsAt } = refillWindow(new Date("2026-07-20T00:00:01Z"));
    assert.equal(startsAt.toISOString(), "2026-07-20T00:00:00.000Z");
  });
});

describe("weeksSince", () => {
  it("counts whole weeks from signup", () => {
    const signup = new Date("2026-07-01T00:00:00Z");
    assert.equal(weeksSince(signup, new Date("2026-07-01T00:00:00Z")), 0);
    assert.equal(weeksSince(signup, new Date("2026-07-07T23:59:00Z")), 0);
    assert.equal(weeksSince(signup, new Date("2026-07-08T00:00:00Z")), 1);
    assert.equal(weeksSince(signup, new Date("2026-07-22T00:00:00Z")), 3);
  });

  it("reads a clock skew backwards as week zero, never negative", () => {
    assert.equal(
      weeksSince(new Date("2026-07-22T00:00:00Z"), new Date("2026-07-01T00:00:00Z")),
      0,
    );
  });
});

describe("predictedLockoutAt", () => {
  const windowStartMs = Date.parse("2026-07-20T00:00:00Z");
  const refillsAtMs = Date.parse("2026-07-27T00:00:00Z");

  it("says nothing about a family making nothing", () => {
    assert.equal(
      predictedLockoutAt({
        used: 0,
        allowance: 10,
        windowStartMs,
        nowMs: Date.parse("2026-07-22T00:00:00Z"),
        refillsAtMs,
      }),
      null,
    );
  });

  it("says nothing once they are already out", () => {
    assert.equal(
      predictedLockoutAt({
        used: 10,
        allowance: 10,
        windowStartMs,
        nowMs: Date.parse("2026-07-22T00:00:00Z"),
        refillsAtMs,
      }),
      null,
    );
  });

  it("projects the date a fast family would hit the wall", () => {
    // Five made in the first two days: five more at that pace lands
    // two days later, comfortably inside the window.
    const at = predictedLockoutAt({
      used: 5,
      allowance: 10,
      windowStartMs,
      nowMs: Date.parse("2026-07-22T00:00:00Z"),
      refillsAtMs,
    });
    assert.equal(at, "2026-07-24T00:00:00.000Z");
  });

  it("says nothing when the refill arrives first", () => {
    // One making in five days never reaches ten before Monday, and a
    // date past the refill is not a lockout, it is arithmetic.
    assert.equal(
      predictedLockoutAt({
        used: 1,
        allowance: 10,
        windowStartMs,
        nowMs: Date.parse("2026-07-25T00:00:00Z"),
        refillsAtMs,
      }),
      null,
    );
  });
});
