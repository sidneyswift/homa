import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterHours,
  periodStart,
  summarizeHours,
  type HoursRow,
} from "./hours-summary";

/**
 * Hours arithmetic (gh#354). Code adds the minutes, never the model.
 *
 * The incident: a parent asked where the hours from her morning phone
 * call had gone and was told nothing from the trip had been logged, three
 * hours after that call logged 4.5 hours of it. Homa could write hours
 * from every channel and read them from none.
 */

function row(overrides: Partial<HoursRow> = {}): HoursRow {
  return {
    childId: null,
    subject: "science",
    minutes: 60,
    happenedOn: "2026-07-25",
    source: "call",
    note: null,
    ...overrides,
  };
}

describe("periodStart", () => {
  it("starts the week on Monday", () => {
    // 2026-07-29 is a Wednesday.
    assert.equal(periodStart("week", "2026-07-29"), "2026-07-27");
  });

  it("treats Sunday as the end of its week, not the start", () => {
    // 2026-08-02 is a Sunday; its Monday is 2026-07-27.
    assert.equal(periodStart("week", "2026-08-02"), "2026-07-27");
  });

  it("starts the month on the first", () => {
    assert.equal(periodStart("month", "2026-07-29"), "2026-07-01");
  });

  it("starts the school year on August 1, and stays in the prior year before August", () => {
    assert.equal(periodStart("school_year", "2026-09-03"), "2026-08-01");
    assert.equal(periodStart("school_year", "2026-07-29"), "2025-08-01");
  });

  it("has no lower bound for all", () => {
    assert.equal(periodStart("all", "2026-07-29"), null);
  });
});

describe("summarizeHours", () => {
  it("totals the real NYC call rows rather than declaring them missing", () => {
    const totals = summarizeHours([
      row({ subject: "science", minutes: 180 }),
      row({ subject: "social studies", minutes: 60 }),
      row({ subject: "social studies", minutes: 30 }),
    ]);
    assert.equal(totals.totalMinutes, 270);
    assert.equal(totals.entryCount, 3);
    assert.deepEqual(totals.bySubject, [
      { subject: "science", minutes: 180 },
      { subject: "social studies", minutes: 90 },
    ]);
  });

  it("splits by child and keeps family-wide time as its own bucket", () => {
    const totals = summarizeHours([
      row({ childId: "kid-a", minutes: 30 }),
      row({ childId: "kid-a", minutes: 15 }),
      row({ childId: null, minutes: 120 }),
    ]);
    assert.deepEqual(totals.byChild, [
      { childId: null, minutes: 120 },
      { childId: "kid-a", minutes: 45 },
    ]);
  });

  it("files an unknown subject under other instead of dropping the minutes", () => {
    const totals = summarizeHours([row({ subject: "underwater basket weaving" })]);
    assert.equal(totals.totalMinutes, 60);
    assert.deepEqual(totals.bySubject, [{ subject: "other", minutes: 60 }]);
  });

  it("reports an empty log as zero, not as an error", () => {
    const totals = summarizeHours([]);
    assert.equal(totals.totalMinutes, 0);
    assert.equal(totals.firstDay, null);
  });

  it("tracks the span the totals actually cover", () => {
    const totals = summarizeHours([
      row({ happenedOn: "2026-07-25" }),
      row({ happenedOn: "2026-07-10" }),
      row({ happenedOn: "2026-07-17" }),
    ]);
    assert.equal(totals.firstDay, "2026-07-10");
    assert.equal(totals.lastDay, "2026-07-25");
  });
});

describe("filterHours", () => {
  it("excludes days before the window start", () => {
    const kept = filterHours(
      [row({ happenedOn: "2026-07-10" }), row({ happenedOn: "2026-07-28" })],
      { from: "2026-07-27" },
    );
    assert.deepEqual(kept.map((entry) => entry.happenedOn), ["2026-07-28"]);
  });

  it("filters by child and subject together", () => {
    const kept = filterHours(
      [
        row({ childId: "kid-a", subject: "math" }),
        row({ childId: "kid-a", subject: "reading" }),
        row({ childId: "kid-b", subject: "math" }),
      ],
      { from: null, childId: "kid-a", subject: "math" },
    );
    assert.equal(kept.length, 1);
  });

  it("keeps everything when no window and no filters are given", () => {
    const rows = [row(), row({ childId: "kid-a" })];
    assert.equal(filterHours(rows, { from: null }).length, 2);
  });
});
