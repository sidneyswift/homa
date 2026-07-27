import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { childTurnsAgeOn } from "./plan-week";

/**
 * D17, birthday on the board (plans/2026-07-21-chat-first-onboarding.md
 * §4.2): render-only age-turned computation. birth_month is a full
 * YYYY-MM-DD date despite its name (migration #55).
 */
describe("childTurnsAgeOn", () => {
  it("matches a real birthday cell and returns the age turned", () => {
    assert.equal(
      childTurnsAgeOn("2020-03-15", { year: 2026, month: 3, day: 15 }),
      6,
    );
  });

  it("does not match a different day in the same month", () => {
    assert.equal(
      childTurnsAgeOn("2020-03-15", { year: 2026, month: 3, day: 16 }),
      null,
    );
  });

  it("does not match the same day-of-month in a different month", () => {
    assert.equal(
      childTurnsAgeOn("2020-03-15", { year: 2026, month: 4, day: 15 }),
      null,
    );
  });

  it("returns null for a malformed or legacy month-only value", () => {
    assert.equal(childTurnsAgeOn("not-a-date", { year: 2026, month: 3, day: 15 }), null);
    assert.equal(childTurnsAgeOn("", { year: 2026, month: 3, day: 15 }), null);
  });

  it("never returns a negative age (a cell year before birth)", () => {
    assert.equal(
      childTurnsAgeOn("2026-03-15", { year: 2025, month: 3, day: 15 }),
      null,
    );
  });

  it("turns zero on the day itself", () => {
    assert.equal(
      childTurnsAgeOn("2026-03-15", { year: 2026, month: 3, day: 15 }),
      0,
    );
  });
});
