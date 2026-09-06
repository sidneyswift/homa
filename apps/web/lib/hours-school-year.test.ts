import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isValidDateOnly, schoolYearStartFor } from "./compliance/deadlines";
import { filterHours, hoursReadIsComplete, minutesBySubjectForChild, periodStart, resolveHoursWindow, summarizeHours, type HoursRow } from "./hours-summary";
import { computeChildTotals, periodStart as viewPeriodStart, type HoursEntry } from "./hours-view";
import { zonedDateString } from "./time-zone";

const stored = "2020-09-10";
const kids = [{ id: "child-a", name: "Alex" }, { id: "child-b", name: "Alex" }];
const entries: HoursEntry[] = [
  { id: "older", childId: "child-a", happenedOn: "2026-08-31", minutes: 70 },
  { id: "week-before", childId: "child-a", happenedOn: "2026-09-08", minutes: 10 },
  { id: "shared-before", childId: null, happenedOn: "2026-09-09", minutes: 20 },
  { id: "anniversary", childId: "child-a", happenedOn: "2026-09-10", minutes: 30 },
  { id: "future", childId: "child-a", happenedOn: "2026-09-11", minutes: 999 },
].map((row) => ({ ...row, childName: row.childId ? "Alex" : null, subject: "spanish", customLabel: null, source: "chat", note: null }));

describe("the family's actual school-year anniversary", () => {
  const cases: [string, string, string][] = [
    [stored, "2026-09-09", "2025-09-10"],
    [stored, "2026-09-10", "2026-09-10"],
    [stored, "2026-12-31", "2026-09-10"],
    [stored, "2027-01-01", "2026-09-10"],
    [stored, "2027-09-10", "2027-09-10"],
    ["2028-02-29", "2030-03-01", "2028-02-29"],
    ["2028-02-29", "2032-02-28", "2028-02-29"],
    ["2028-02-29", "2032-02-29", "2032-02-29"],
    ["2028-02-29", "2033-03-01", "2032-02-29"],
    ["2096-02-29", "2100-03-01", "2096-02-29"],
    ["2096-02-29", "2103-12-31", "2096-02-29"],
    ["2096-02-29", "2104-02-28", "2096-02-29"],
    ["2096-02-29", "2104-02-29", "2104-02-29"],
  ];
  for (const [start, today, expected] of cases) it(`${start} at ${today}: ${expected} on every resolver`, () => {
    assert.equal(schoolYearStartFor(start, today), expected);
    assert.equal(periodStart("school_year", today, start), expected);
    assert.equal(viewPeriodStart("schoolYear", new Date(`${today}T12:00:00Z`), "UTC", start), expected);
    assert.equal(resolveHoursWindow("school_year", today, start).from, expected);
  });
  it("validates the entire stored date and entire reference date", () => {
    for (const invalid of ["not a date", "2026-00-01", "2026-13-01", "2026-02-00", "2026-02-29", "2026-04-31", "0000-01-01", "2026-09-10T00:00:00Z"]){
      assert.equal(isValidDateOnly(invalid), false, invalid);
      assert.equal(schoolYearStartFor(invalid, "2026-09-10"), null, invalid);
      assert.equal(schoolYearStartFor(stored, invalid), null, invalid);
      for (const period of ["week", "month", "school_year", "all"] as const) assert.throws(() => resolveHoursWindow(period, invalid, stored), RangeError);
    }
    assert.equal(schoolYearStartFor(" 2020-09-10 ", " 2026-09-10 "), "2026-09-10");
    assert.equal(schoolYearStartFor("0001-01-01", "0001-06-01"), "0001-01-01");
  });
  it("labels an unset or invalid start all time through a valid today", () => {
    for (const start of [null, "", "2026-02-30", "2026-13-01"]) {
      assert.deepEqual(resolveHoursWindow("school_year", "2026-09-10", start), { from: null, through: "2026-09-10", period: "all", schoolYearFallback: true, label: "All time" });
    }
  });
  it("uses family-local midnight rather than the server's date", () => {
    const instant = new Date("2026-09-10T04:30:00Z");
    const la = zonedDateString(instant, "America/Los_Angeles");
    const ny = zonedDateString(instant, "America/New_York");
    assert.equal(la, "2026-09-09");
    assert.equal(ny, "2026-09-10");
    assert.equal(viewPeriodStart("schoolYear", instant, "America/Los_Angeles", stored), "2025-09-10");
    assert.equal(viewPeriodStart("schoolYear", instant, "America/New_York", stored), "2026-09-10");
  });
});

describe("independent current-period totals", () => {
  it("does not let a school-year anniversary trim the week or month", () => {
    const totals = computeChildTotals(entries, kids, new Date("2026-09-10T15:00:00Z"), "America/New_York", stored);
    assert.deepEqual(totals, [
      { childId: "child-a", childName: "Alex", week: 60, month: 60, schoolYear: 30 },
      { childId: "child-b", childName: "Alex", week: 20, month: 20, schoolYear: 0 },
    ]);
  });
  it("does not let a January school-year start erase December's days in this week", () => {
    const rows = [
      { ...entries[0], happenedOn: "2026-12-30", minutes: 10 },
      { ...entries[0], happenedOn: "2027-01-01", minutes: 20 },
      { ...entries[0], happenedOn: "2027-01-02", minutes: 999 },
    ];
    assert.deepEqual(computeChildTotals(rows, [kids[0]], new Date("2027-01-01T12:00:00Z"), "UTC", "2020-01-01")[0], { childId: "child-a", childName: "Alex", week: 30, month: 20, schoolYear: 20 });
  });
  it("keeps UI and display-only Progress scope identical, including shared time", () => {
    const today = "2026-09-09";
    const window = resolveHoursWindow("school_year", today, stored);
    const totals = computeChildTotals(entries, kids, new Date(`${today}T15:00:00Z`), "UTC", stored);
    assert.equal(totals[0].schoolYear, 100);
    assert.equal(totals[1].schoolYear, 20);
    assert.deepEqual(minutesBySubjectForChild(entries, "child-a", window.from, window.through), { spanish: 100 });
    assert.deepEqual(minutesBySubjectForChild(entries, "child-b", window.from, window.through), { spanish: 20 });
  });
  it("all-time fallback includes old records but excludes future records", () => {
    const window = resolveHoursWindow("school_year", "2026-09-10", null);
    assert.equal(summarizeHours(filterHours(entries, { from: window.from, through: window.through })).totalMinutes, 130);
    assert.equal(computeChildTotals(entries, [kids[0]], new Date("2026-09-10T12:00:00Z"), "UTC", null)[0].schoolYear, 130);
    assert.deepEqual(minutesBySubjectForChild(entries, "child-a", window.from, window.through), { spanish: 130 });
  });
  it("bounds every chat period through today without changing an explicit historical range", () => {
    for (const period of ["week", "month", "school_year", "all"] as const) {
      const window = resolveHoursWindow(period, "2026-09-10", stored);
      const matching = filterHours(entries, { from: window.from, through: window.through });
      assert.ok(matching.every((row) => row.happenedOn <= "2026-09-10"));
    }
    // An explicit supplied end is authoritative for a historical/selected view.
    assert.equal(filterHours(entries as HoursRow[], { from: "2026-09-11", through: "2026-09-11" })[0].minutes, 999);
  });
});

describe("bounded read completeness receipts", () => {
  it("recognizes an exact complete count, including an empty record", () => {
    assert.equal(hoursReadIsComplete(0, 0), true);
    assert.equal(hoursReadIsComplete(3000, 3000), true);
  });
  it("refuses a full local cap, a smaller PostgREST cap, and a missing count", () => {
    assert.equal(hoursReadIsComplete(3001, 3000), false);
    assert.equal(hoursReadIsComplete(2000, 1000), false);
    assert.equal(hoursReadIsComplete(null, 0), false);
    assert.equal(hoursReadIsComplete(null, 20), false);
    assert.equal(hoursReadIsComplete(-1, 0), false);
    assert.equal(hoursReadIsComplete(1.5, 1), false);
  });
});
