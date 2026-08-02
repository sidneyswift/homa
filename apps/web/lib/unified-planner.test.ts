import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addMonthsDateOnly,
  monthCellsForDate,
  monthGridRangeForDate,
  parsePlannerDate,
  parsePlannerView,
  todayDateOnly,
  weekOffsetDaysForDate,
  weekRangeForDate,
} from "./unified-planner";

describe("unified Planner date model", () => {
  it("defaults unknown views to Day", () => {
    assert.equal(parsePlannerView(undefined), "day");
    assert.equal(parsePlannerView("calendar"), "day");
    assert.equal(parsePlannerView(["hours", "week"]), "hours");
  });

  it("derives today in the family's time zone", () => {
    const now = new Date("2026-08-03T02:30:00.000Z");
    assert.equal(todayDateOnly(now, "America/New_York"), "2026-08-02");
    assert.equal(todayDateOnly(now, "UTC"), "2026-08-03");
  });

  it("accepts valid nearby dates and rejects malformed or distant dates", () => {
    assert.equal(parsePlannerDate("2026-08-09", "2026-08-02"), "2026-08-09");
    assert.equal(parsePlannerDate("2026-02-30", "2026-08-02"), "2026-08-02");
    assert.equal(parsePlannerDate("2030-01-01", "2026-08-02"), "2026-08-02");
  });

  it("builds Monday-first week ranges and whole-week offsets", () => {
    assert.deepEqual(weekRangeForDate("2026-08-02"), {
      start: "2026-07-27",
      end: "2026-08-02",
    });
    assert.equal(weekOffsetDaysForDate("2026-08-02", "2026-08-09"), 7);
  });

  it("builds a Sunday-first month grid with stable today state", () => {
    const cells = monthCellsForDate("2026-08-14", "2026-08-02");
    assert.equal(cells.length, 42);
    assert.equal(cells[0]?.date, "2026-07-26");
    assert.equal(cells[41]?.date, "2026-09-05");
    assert.equal(cells.find((cell) => cell.isToday)?.date, "2026-08-02");
    assert.deepEqual(monthGridRangeForDate("2026-08-14", "2026-08-02"), {
      start: "2026-07-26",
      end: "2026-09-05",
    });
  });

  it("clamps month navigation to the destination month", () => {
    assert.equal(addMonthsDateOnly("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonthsDateOnly("2024-01-31", 1), "2024-02-29");
  });
});
