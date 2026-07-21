import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { weeksSince, weekWindow } from "./makings";

describe("weekWindow", () => {
  it("runs Monday to Monday, whatever day it is asked", () => {
    // 2026-07-21 is a Tuesday.
    const { startsAt, endsAt } = weekWindow(new Date("2026-07-21T18:30:00Z"));
    assert.equal(startsAt.toISOString(), "2026-07-20T00:00:00.000Z");
    assert.equal(endsAt.toISOString(), "2026-07-27T00:00:00.000Z");
  });

  it("puts Sunday at the END of its week, not the start", () => {
    // The off-by-one that would split a family's week in half and make
    // every count read low.
    const { startsAt } = weekWindow(new Date("2026-07-26T23:00:00Z"));
    assert.equal(startsAt.toISOString(), "2026-07-20T00:00:00.000Z");
  });

  it("treats Monday itself as the start of its own week", () => {
    const { startsAt } = weekWindow(new Date("2026-07-20T00:00:01Z"));
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
