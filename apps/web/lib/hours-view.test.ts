import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HoursLogRow } from "./hours";
import type { ChildRecord } from "./family";
import {
  computeChildTotals,
  dayLabel,
  filterEntries,
  formatMinutesAsHours,
  groupEntriesByDay,
  isDefaultFilter,
  periodStart,
  scopedToViewContext,
  subjectOptions,
  toHoursEntries,
  type HoursEntry,
} from "./hours-view";

function row(overrides: Partial<HoursLogRow> = {}): HoursLogRow {
  return {
    id: "row-1",
    childId: "child-maya",
    subject: "math",
    minutes: 45,
    happenedOn: "2026-07-10",
    source: "chat",
    note: null,
    ...overrides,
  };
}

function child(overrides: Partial<ChildRecord> = {}): ChildRecord {
  return {
    id: "child-maya",
    family_id: "family-1",
    name: "Maya",
    birth_month: "2019-03",
    profile: {},
    avatar_url: null,
    ...overrides,
  };
}

const MAYA = child();
const LEO = child({ id: "child-leo", name: "Leo" });

describe("toHoursEntries", () => {
  it("resolves the child's name from the family's own children", () => {
    const [entry] = toHoursEntries([row()], [MAYA, LEO]);
    assert.equal(entry.childName, "Maya");
  });

  it("keeps a null child as family-wide, never a lookup miss", () => {
    const [entry] = toHoursEntries([row({ childId: null })], [MAYA, LEO]);
    assert.equal(entry.childId, null);
    assert.equal(entry.childName, null);
  });

  it("falls back an unrecognized child id to null rather than throwing", () => {
    const [entry] = toHoursEntries([row({ childId: "stranger" })], [MAYA]);
    assert.equal(entry.childName, null);
  });
});

describe("scopedToViewContext", () => {
  const entries: HoursEntry[] = [
    { ...toHoursEntries([row({ id: "a", childId: "child-maya" })], [MAYA, LEO])[0] },
    { ...toHoursEntries([row({ id: "b", childId: "child-leo" })], [MAYA, LEO])[0] },
    { ...toHoursEntries([row({ id: "c", childId: null })], [MAYA, LEO])[0] },
  ];

  it("keeps everything for the whole family", () => {
    const scoped = scopedToViewContext(entries, { kind: "family" });
    assert.deepEqual(scoped.map((entry) => entry.id), ["a", "b", "c"]);
  });

  it("keeps one kid's own blocks plus family-wide blocks, drops the sibling's", () => {
    const scoped = scopedToViewContext(entries, { kind: "child", childId: "child-maya" });
    assert.deepEqual(scoped.map((entry) => entry.id), ["a", "c"]);
  });
});

describe("subjectOptions", () => {
  it("lists only present subjects, in the record's fixed vocabulary order", () => {
    const entries = toHoursEntries(
      [
        row({ id: "a", subject: "other" }),
        row({ id: "b", subject: "reading" }),
        row({ id: "c", subject: "math" }),
      ],
      [MAYA],
    );
    // Fixed order (reading, math, ... other), never alphabetical or by
    // count, or first-seen order (which here would be other, reading, math).
    assert.deepEqual(subjectOptions(entries), ["reading", "math", "other"]);
  });

  it("returns nothing for an empty log", () => {
    assert.deepEqual(subjectOptions([]), []);
  });
});

describe("filterEntries", () => {
  const entries = toHoursEntries(
    [row({ id: "a", subject: "math" }), row({ id: "b", subject: "reading" })],
    [MAYA],
  );

  it("returns everything with no subject picked", () => {
    assert.equal(isDefaultFilter({ subject: null }), true);
    assert.deepEqual(filterEntries(entries, { subject: null }).map((e) => e.id), ["a", "b"]);
  });

  it("narrows to the one subject", () => {
    assert.equal(isDefaultFilter({ subject: "math" }), false);
    assert.deepEqual(filterEntries(entries, { subject: "math" }).map((e) => e.id), ["a"]);
  });
});

describe("dayLabel", () => {
  // Saturday Jul 11, 2026, 6pm in New York (matches the Tasks fixture).
  const now = new Date("2026-07-11T22:00:00.000Z");

  it("names today and yesterday plainly", () => {
    assert.equal(dayLabel("2026-07-11", "America/New_York", now), "Today");
    assert.equal(dayLabel("2026-07-10", "America/New_York", now), "Yesterday");
  });

  it("names older days with a stable weekday, regardless of the renderer's clock", () => {
    assert.equal(dayLabel("2026-07-06", "America/New_York", now), "Mon, Jul 6");
  });
});

describe("groupEntriesByDay", () => {
  const now = new Date("2026-07-11T22:00:00.000Z");

  it("groups newest-first entries under one row per day and sums minutes", () => {
    const entries = toHoursEntries(
      [
        row({ id: "a", happenedOn: "2026-07-11", minutes: 30 }),
        row({ id: "b", happenedOn: "2026-07-10", minutes: 45 }),
        row({ id: "c", happenedOn: "2026-07-10", minutes: 15 }),
        row({ id: "d", happenedOn: "2026-07-06", minutes: 60 }),
      ],
      [MAYA],
    );
    const groups = groupEntriesByDay(entries, "America/New_York", now);
    assert.deepEqual(
      groups.map((group) => [group.label, group.entries.map((e) => e.id), group.totalMinutes]),
      [
        ["Today", ["a"], 30],
        ["Yesterday", ["b", "c"], 60],
        ["Mon, Jul 6", ["d"], 60],
      ],
    );
  });
});

describe("periodStart", () => {
  it("finds Monday of the current week", () => {
    // Wednesday Feb 17, 2027, 1pm in New York.
    const now = new Date("2027-02-17T18:00:00.000Z");
    assert.equal(periodStart("week", now, "America/New_York"), "2027-02-15");
  });

  it("finds the 1st of the current month", () => {
    const now = new Date("2027-02-17T18:00:00.000Z");
    assert.equal(periodStart("month", now, "America/New_York"), "2027-02-01");
  });

  it("finds last July 1 when the current month is before July", () => {
    const now = new Date("2027-02-17T18:00:00.000Z");
    assert.equal(periodStart("schoolYear", now, "America/New_York"), "2026-07-01");
  });

  it("finds this year's July 1 when the current month is July or later", () => {
    const now = new Date("2026-07-11T22:00:00.000Z");
    assert.equal(periodStart("schoolYear", now, "America/New_York"), "2026-07-01");
  });
});

describe("computeChildTotals", () => {
  // Wednesday Feb 17, 2027: week starts Feb 15, month starts Feb 1,
  // school year starts Jul 1, 2026.
  const now = new Date("2027-02-17T18:00:00.000Z");
  const timeZone = "America/New_York";

  it("sums minutes per child across week, month, and school year", () => {
    const entries = toHoursEntries(
      [
        row({ id: "a", childId: "child-maya", happenedOn: "2027-02-16", minutes: 30 }), // this week
        row({ id: "b", childId: "child-maya", happenedOn: "2027-02-05", minutes: 20 }), // this month, not this week
        row({ id: "c", childId: "child-maya", happenedOn: "2026-08-01", minutes: 10 }), // this school year only
        row({ id: "d", childId: "child-maya", happenedOn: "2026-01-01", minutes: 999 }), // last school year, excluded
      ],
      [MAYA, LEO],
    );
    const totals = computeChildTotals(entries, [MAYA, LEO], now, timeZone);
    const maya = totals.find((t) => t.childId === "child-maya");
    assert.deepEqual(maya, { childId: "child-maya", childName: "Maya", week: 30, month: 50, schoolYear: 60 });
  });

  it("folds family-wide blocks into every child's total", () => {
    const entries = toHoursEntries(
      [row({ id: "a", childId: null, happenedOn: "2027-02-16", minutes: 40 })],
      [MAYA, LEO],
    );
    const totals = computeChildTotals(entries, [MAYA, LEO], now, timeZone);
    assert.equal(totals.find((t) => t.childId === "child-maya")?.week, 40);
    assert.equal(totals.find((t) => t.childId === "child-leo")?.week, 40);
  });

  it("keeps a sibling's own block out of the other child's total", () => {
    const entries = toHoursEntries(
      [row({ id: "a", childId: "child-leo", happenedOn: "2027-02-16", minutes: 40 })],
      [MAYA, LEO],
    );
    const totals = computeChildTotals(entries, [MAYA, LEO], now, timeZone);
    assert.equal(totals.find((t) => t.childId === "child-maya")?.week, 0);
    assert.equal(totals.find((t) => t.childId === "child-leo")?.week, 40);
  });
});

describe("formatMinutesAsHours", () => {
  it("formats whole minutes, whole hours, and mixed", () => {
    assert.equal(formatMinutesAsHours(0), "0m");
    assert.equal(formatMinutesAsHours(45), "45m");
    assert.equal(formatMinutesAsHours(60), "1h");
    assert.equal(formatMinutesAsHours(90), "1h 30m");
    assert.equal(formatMinutesAsHours(605), "10h 5m");
  });

  it("never goes negative", () => {
    assert.equal(formatMinutesAsHours(-30), "0m");
  });
});
