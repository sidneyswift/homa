import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FamilyEventRow } from "./family-events";
import type { PlanActivityScheduleRow } from "./plan-schedule";
import type { DashboardPlan } from "./plan-week";
import {
  bannerWhenLabel,
  buildCalendarBoard,
  calendarWeekDates,
  formatTimeRange,
  layoutTimedItems,
  parseWeekOffset,
  minutesToTimeInput,
  movedTimes,
  snapToHalfHour,
  timeToMinutes,
  timedWindow,
  type BuildCalendarBoardInput,
} from "./calendar-view";

/**
 * The unified /app/calendar board (issue #176, CG-03): merges scheduled
 * plan activities, family_events, and hours_log into per-kid lanes plus
 * a family lane for one week, exactly the shape a co-founder asked for
 * ("an option for each kid and then a family calendar"). Every source
 * here is a plain in-memory fixture; the real reads live in
 * lib/family-events.ts, lib/plan-schedule.ts, and lib/hours.ts.
 */

// Saturday Aug 8, 2026, 6pm in New York: the week is Mon Aug 3 to Sun Aug 9.
const NOW = new Date("2026-08-08T22:00:00.000Z");
const TIME_ZONE = "America/New_York";

function mayaPlan(overrides: Partial<DashboardPlan> = {}): DashboardPlan {
  return {
    childId: "child-maya",
    subjectId: "math",
    done: 0,
    total: 2,
    retestAt: "2026-08-31T00:00:00Z",
    weeks: [
      { week: 1, focus: "counting", activities: ["Count to 20 daily", "Play a counting game"] },
    ],
    progress: {},
    activitySources: {},
    ...overrides,
  };
}

function event(overrides: Partial<FamilyEventRow> = {}): FamilyEventRow {
  return {
    id: "event-1",
    familyId: "family-1",
    childId: null,
    title: "Doctor's appt",
    startsOn: "2026-08-04",
    endsOn: "2026-08-04",
    startTime: "14:00",
    endTime: "15:00",
    note: null,
    createdAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function schedule(overrides: Partial<PlanActivityScheduleRow> = {}): PlanActivityScheduleRow {
  return {
    id: "schedule-1",
    familyId: "family-1",
    childId: "child-maya",
    subjectId: "math",
    week: 1,
    activityIndex: 0,
    scheduledDate: "2026-08-04",
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const MAYA = { id: "child-maya", name: "Maya", avatarUrl: null };
const LEO = { id: "child-leo", name: "Leo", avatarUrl: null };

function board(overrides: Partial<BuildCalendarBoardInput> = {}): ReturnType<typeof buildCalendarBoard> {
  return buildCalendarBoard({
    kids: [MAYA, LEO],
    plans: [],
    scheduledActivities: [],
    familyEvents: [],
    hoursEntries: [],
    reportTokens: new Map([
      ["child-maya", "token-maya"],
      ["child-leo", "token-leo"],
    ]),
    now: NOW,
    timeZone: TIME_ZONE,
    focusChildId: null,
    ...overrides,
  });
}

describe("calendarWeekDates", () => {
  it("returns Monday through Sunday with real calendar dates", () => {
    const days = calendarWeekDates(NOW, TIME_ZONE);
    assert.deepEqual(
      days.map((day) => [day.label, day.date]),
      [
        ["Mon", "2026-08-03"],
        ["Tue", "2026-08-04"],
        ["Wed", "2026-08-05"],
        ["Thu", "2026-08-06"],
        ["Fri", "2026-08-07"],
        ["Sat", "2026-08-08"],
        ["Sun", "2026-08-09"],
      ],
    );
  });

  it("marks exactly the day lived as today", () => {
    const days = calendarWeekDates(NOW, TIME_ZONE);
    const todays = days.filter((day) => day.isToday);
    assert.equal(todays.length, 1);
    assert.equal(todays[0].date, "2026-08-08");
  });

  it("shifts a whole week forward when given a positive weekOffsetDays", () => {
    const days = calendarWeekDates(NOW, TIME_ZONE, 7);
    assert.deepEqual(
      days.map((day) => day.date),
      ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"],
    );
  });

  it("shifts a whole week back when given a negative weekOffsetDays", () => {
    const days = calendarWeekDates(NOW, TIME_ZONE, -7);
    assert.deepEqual(
      days.map((day) => day.date),
      ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"],
    );
  });

  it("marks no day 'today' once paged away from the real current week", () => {
    const nextWeek = calendarWeekDates(NOW, TIME_ZONE, 7);
    const lastWeek = calendarWeekDates(NOW, TIME_ZONE, -7);
    assert.equal(nextWeek.some((day) => day.isToday), false);
    assert.equal(lastWeek.some((day) => day.isToday), false);
  });
});

describe("parseWeekOffset", () => {
  it("defaults to this week when the param is missing", () => {
    assert.equal(parseWeekOffset(undefined), 0);
  });

  it("parses a plain integer either direction", () => {
    assert.equal(parseWeekOffset("3"), 3);
    assert.equal(parseWeekOffset("-5"), -5);
  });

  it("falls back to this week on garbage input rather than NaN propagating", () => {
    assert.equal(parseWeekOffset("not-a-number"), 0);
    assert.equal(parseWeekOffset(""), 0);
  });

  it("clamps a wildly large offset instead of computing a pathological date", () => {
    assert.equal(parseWeekOffset("999999"), 104);
    assert.equal(parseWeekOffset("-999999"), -104);
  });
});

describe("buildCalendarBoard: kid lanes", () => {
  it("creates one lane per visible kid, in family roster order with stable indices", () => {
    const result = board();
    assert.deepEqual(
      result.kidLanes.map((lane) => [lane.childId, lane.kidIndex]),
      [
        ["child-maya", 0],
        ["child-leo", 1],
      ],
    );
  });

  it("narrows to one kid's lane when focused, keeping their real roster index", () => {
    const result = board({ focusChildId: "child-leo" });
    assert.deepEqual(
      result.kidLanes.map((lane) => lane.childId),
      ["child-leo"],
    );
    assert.equal(result.kidLanes[0].kidIndex, 1);
  });

  it("places a scheduled activity on its real date with fresh text and done state", () => {
    const result = board({
      plans: [mayaPlan({ progress: { "1.0": true } })],
      scheduledActivities: [schedule()],
    });
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    const tuesday = maya.days.find((day) => day.date === "2026-08-04")!;
    assert.equal(tuesday.activities.length, 1);
    assert.deepEqual(tuesday.activities[0], {
      key: "child-maya:math:1.0",
      childId: "child-maya",
      subjectId: "math",
      subjectLabel: "Math",
      checkId: "1.0",
      text: "Count to 20 daily",
      done: true,
      token: "token-maya",
    });
    // No other day carries it.
    for (const day of maya.days) {
      if (day.date !== "2026-08-04") assert.equal(day.activities.length, 0);
    }
  });

  it("carries no token for a child with no report, so the item stays read-only", () => {
    const result = board({
      plans: [mayaPlan()],
      scheduledActivities: [schedule()],
      reportTokens: new Map(),
    });
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    assert.equal(maya.days.find((day) => day.date === "2026-08-04")!.activities[0].token, null);
  });

  it("drops a scheduled activity whose index no longer exists in the current plan", () => {
    const result = board({
      plans: [mayaPlan()],
      scheduledActivities: [schedule({ activityIndex: 9 })],
    });
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    assert.equal(maya.days.every((day) => day.activities.length === 0), true);
  });

  it("drops a scheduled activity dated outside the visible week", () => {
    const result = board({
      plans: [mayaPlan()],
      scheduledActivities: [schedule({ scheduledDate: "2026-08-20" })],
    });
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    assert.equal(maya.days.every((day) => day.activities.length === 0), true);
  });

  it("never lets one kid's scheduled activity land on a sibling's lane", () => {
    const result = board({
      plans: [mayaPlan()],
      scheduledActivities: [schedule()],
    });
    const leo = result.kidLanes.find((lane) => lane.childId === "child-leo")!;
    assert.equal(leo.days.every((day) => day.activities.length === 0), true);
  });
});

describe("buildCalendarBoard: family events", () => {
  it("places a whole-family event on the family lane, not any kid's lane", () => {
    const result = board({ familyEvents: [event()] });
    const tuesday = result.familyDays.find((day) => day.date === "2026-08-04")!;
    assert.equal(tuesday.events.length, 1);
    assert.equal(tuesday.events[0].title, "Doctor's appt");
    for (const lane of result.kidLanes) {
      for (const day of lane.days) assert.equal(day.events.length, 0);
    }
  });

  it("places a child-scoped event only on that kid's lane", () => {
    const result = board({
      familyEvents: [event({ childId: "child-leo", title: "Leo's dentist" })],
    });
    const leo = result.kidLanes.find((lane) => lane.childId === "child-leo")!;
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    assert.equal(leo.days.find((day) => day.date === "2026-08-04")!.events.length, 1);
    assert.equal(maya.days.every((day) => day.events.length === 0), true);
    assert.equal(result.familyDays.every((day) => day.events.length === 0), true);
  });

  it("spans a multi-day event across every day it covers, marked multiDay", () => {
    const result = board({
      familyEvents: [
        event({ id: "trip", title: "Camping trip", startsOn: "2026-08-06", endsOn: "2026-08-09" }),
      ],
    });
    const covered = result.familyDays.filter((day) => day.events.length > 0).map((day) => day.date);
    assert.deepEqual(covered, ["2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"]);
    assert.equal(result.familyDays[0].events.length === 0, true);
    for (const day of result.familyDays) {
      for (const item of day.events) assert.equal(item.multiDay, true);
    }
  });

  it("clips a multi-day event to the visible week", () => {
    const result = board({
      familyEvents: [event({ startsOn: "2026-08-01", endsOn: "2026-08-05" })],
    });
    const covered = result.familyDays.filter((day) => day.events.length > 0).map((day) => day.date);
    assert.deepEqual(covered, ["2026-08-03", "2026-08-04", "2026-08-05"]);
  });
});

describe("buildCalendarBoard: hours indicator", () => {
  it("sums a child's own hours for that day", () => {
    const result = board({
      hoursEntries: [
        { childId: "child-maya", happenedOn: "2026-08-04", minutes: 30 },
        { childId: "child-maya", happenedOn: "2026-08-04", minutes: 15 },
      ],
    });
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    assert.equal(maya.days.find((day) => day.date === "2026-08-04")!.hoursMinutes, 45);
  });

  it("folds a family-wide hours block into every visible kid's day", () => {
    const result = board({
      hoursEntries: [{ childId: null, happenedOn: "2026-08-04", minutes: 40 }],
    });
    for (const lane of result.kidLanes) {
      assert.equal(lane.days.find((day) => day.date === "2026-08-04")!.hoursMinutes, 40);
    }
  });

  it("keeps a sibling's own hours off the other kid's day", () => {
    const result = board({
      hoursEntries: [{ childId: "child-leo", happenedOn: "2026-08-04", minutes: 40 }],
    });
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    assert.equal(maya.days.find((day) => day.date === "2026-08-04")!.hoursMinutes, 0);
  });

  it("drops hours logged outside the visible week", () => {
    const result = board({
      hoursEntries: [{ childId: "child-maya", happenedOn: "2026-07-01", minutes: 40 }],
    });
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    assert.equal(maya.days.every((day) => day.hoursMinutes === 0), true);
  });
});

describe("buildCalendarBoard: week navigation", () => {
  it("hides an activity scheduled for next week while showing this week", () => {
    const result = board({
      plans: [mayaPlan()],
      scheduledActivities: [schedule({ scheduledDate: "2026-08-11" })],
    });
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    assert.equal(
      maya.days.every((day) => day.activities.length === 0),
      true,
    );
  });

  it("shows that same activity once paged forward to next week", () => {
    const result = board({
      plans: [mayaPlan()],
      scheduledActivities: [schedule({ scheduledDate: "2026-08-11" })],
      weekOffsetDays: 7,
    });
    const maya = result.kidLanes.find((lane) => lane.childId === "child-maya")!;
    const tuesday = maya.days.find((day) => day.date === "2026-08-11")!;
    assert.equal(tuesday.activities.length, 1);
    assert.equal(tuesday.activities[0].text, "Count to 20 daily");
  });

  it("hides a family event scheduled for last week while showing this week", () => {
    const result = board({ familyEvents: [event({ startsOn: "2026-07-28", endsOn: "2026-07-28" })] });
    assert.equal(
      result.familyDays.every((day) => day.events.length === 0),
      true,
    );
  });

  it("shows that same family event once paged back to last week", () => {
    const result = board({
      familyEvents: [event({ startsOn: "2026-07-28", endsOn: "2026-07-28" })],
      weekOffsetDays: -7,
    });
    const tuesday = result.familyDays.find((day) => day.date === "2026-07-28")!;
    assert.equal(tuesday.events.length, 1);
  });
});

describe("timeToMinutes", () => {
  it("parses HH:MM and Postgres HH:MM:SS alike", () => {
    assert.equal(timeToMinutes("14:00"), 840);
    assert.equal(timeToMinutes("09:30:00"), 570);
    assert.equal(timeToMinutes("0:05"), 5);
  });

  it("returns null on garbage instead of NaN", () => {
    assert.equal(timeToMinutes(null), null);
    assert.equal(timeToMinutes("noonish"), null);
    assert.equal(timeToMinutes("25:00"), null);
    assert.equal(timeToMinutes("12:75"), null);
  });
});

describe("formatTimeRange", () => {
  it("drops the shared meridiem the way a parent says it", () => {
    assert.equal(formatTimeRange("14:00", "15:00"), "2 to 3 PM");
    assert.equal(formatTimeRange("09:00", "11:30"), "9 to 11:30 AM");
  });

  it("keeps both meridiems when the range crosses noon", () => {
    assert.equal(formatTimeRange("09:30", "13:00"), "9:30 AM to 1 PM");
  });

  it("falls back to just the start when the end is missing", () => {
    assert.equal(formatTimeRange("15:30", null), "3:30 PM");
  });
});

describe("bannerWhenLabel", () => {
  it("labels a truly all-day multi-day event as all day", () => {
    assert.equal(
      bannerWhenLabel({
        startDayLabel: "Sat 8",
        endDayLabel: "Sun 9",
        spansMultipleCells: true,
        firstDayInView: true,
        startTime: null,
        endTime: null,
      }),
      "Sat 8 to Sun 9, all day",
    );
  });

  it("carries a timed multi-day event's first-day window instead of 'all day' (issue #256)", () => {
    // Migration 20260726130000: start_time/end_time are a first-day-only
    // window, so "all day" was a fabrication for this shape.
    assert.equal(
      bannerWhenLabel({
        startDayLabel: "Wed 5",
        endDayLabel: "Sun 9",
        spansMultipleCells: true,
        firstDayInView: true,
        startTime: "14:00",
        endTime: "15:00",
      }),
      "Wed 5 to Sun 9, 2 to 3 PM on the first day",
    );
  });

  it("keeps 'all day' for a clipped week that no longer shows the first day", () => {
    // The time window lives on the event's first day; when this week's
    // visible slice starts later, the days on screen really are all day.
    assert.equal(
      bannerWhenLabel({
        startDayLabel: "Mon 10",
        endDayLabel: "Tue 11",
        spansMultipleCells: true,
        firstDayInView: false,
        startTime: "14:00",
        endTime: "15:00",
      }),
      "Mon 10 to Tue 11, all day",
    );
  });

  it("shows the window plainly when only the first day is visible", () => {
    assert.equal(
      bannerWhenLabel({
        startDayLabel: "Sun 9",
        endDayLabel: "Sun 9",
        spansMultipleCells: false,
        firstDayInView: true,
        startTime: "14:00",
        endTime: null,
      }),
      "Sun 9, 2 PM",
    );
  });

  it("labels a single-day all-day event as all day", () => {
    assert.equal(
      bannerWhenLabel({
        startDayLabel: "Thu 6",
        endDayLabel: "Thu 6",
        spansMultipleCells: false,
        firstDayInView: true,
        startTime: null,
        endTime: null,
      }),
      "Thu 6, all day",
    );
  });
});

describe("layoutTimedItems", () => {
  it("gives non-overlapping items the full width", () => {
    const placed = layoutTimedItems([
      { startMin: 540, endMin: 600 },
      { startMin: 600, endMin: 660 },
    ]);
    assert.deepEqual(
      placed.map((item) => [item.slot, item.slotCount]),
      [
        [0, 1],
        [0, 1],
      ],
    );
  });

  it("sits two overlapping items side by side, sharing the width", () => {
    const placed = layoutTimedItems([
      { startMin: 960, endMin: 1020 },
      { startMin: 990, endMin: 1050 },
    ]);
    assert.deepEqual(
      placed.map((item) => [item.slot, item.slotCount]),
      [
        [0, 2],
        [1, 2],
      ],
    );
  });

  it("reuses a freed slot within one cluster and keeps the cluster width", () => {
    const placed = layoutTimedItems([
      { startMin: 540, endMin: 600 },
      { startMin: 570, endMin: 630 },
      { startMin: 600, endMin: 660 },
    ]);
    assert.deepEqual(
      placed.map((item) => [item.slot, item.slotCount]),
      [
        [0, 2],
        [1, 2],
        [0, 2],
      ],
    );
  });
});

describe("timedWindow", () => {
  it("keeps the school-day default when everything fits inside it", () => {
    assert.deepEqual(timedWindow([{ startMin: 600, endMin: 660 }]), {
      startHour: 8,
      endHour: 17,
    });
  });

  it("expands for an early start and a late end, floored and ceiled to hours", () => {
    assert.deepEqual(
      timedWindow([
        { startMin: 6 * 60 + 30, endMin: 7 * 60 },
        { startMin: 17 * 60 + 15, endMin: 18 * 60 + 20 },
      ]),
      { startHour: 6, endHour: 19 },
    );
  });
});

describe("minutesToTimeInput and snapToHalfHour", () => {
  it("formats minutes as the HH:MM a time input expects", () => {
    assert.equal(minutesToTimeInput(510), "08:30");
    assert.equal(minutesToTimeInput(0), "00:00");
    assert.equal(minutesToTimeInput(14 * 60), "14:00");
  });

  it("clamps out-of-day values instead of overflowing", () => {
    assert.equal(minutesToTimeInput(-30), "00:00");
    assert.equal(minutesToTimeInput(25 * 60), "23:59");
  });

  it("snaps a mid-cell tap to the nearest half hour", () => {
    assert.equal(snapToHalfHour(9 * 60 + 7), 9 * 60);
    assert.equal(snapToHalfHour(9 * 60 + 20), 9 * 60 + 30);
    assert.equal(snapToHalfHour(9 * 60 + 46), 10 * 60);
  });
});

describe("movedTimes", () => {
  const WINDOW = { windowStartHour: 8, windowEndHour: 17 };

  it("moves an event by the dragged delta, snapped to the half hour", () => {
    assert.deepEqual(
      movedTimes({ startMin: 14 * 60, endMin: 15 * 60, deltaMinutes: 62, ...WINDOW }),
      { startMin: 15 * 60, endMin: 16 * 60 },
    );
  });

  it("preserves duration rather than resizing", () => {
    const moved = movedTimes({
      startMin: 9 * 60,
      endMin: 11 * 60 + 30,
      deltaMinutes: 90,
      ...WINDOW,
    });
    assert.equal(moved.endMin - moved.startMin, 150);
  });

  it("moves backwards on a negative delta", () => {
    assert.deepEqual(
      movedTimes({ startMin: 14 * 60, endMin: 15 * 60, deltaMinutes: -120, ...WINDOW }),
      { startMin: 12 * 60, endMin: 13 * 60 },
    );
  });

  it("clamps at the top of the window instead of parking off-grid", () => {
    assert.deepEqual(
      movedTimes({ startMin: 9 * 60, endMin: 10 * 60, deltaMinutes: -600, ...WINDOW }),
      { startMin: 8 * 60, endMin: 9 * 60 },
    );
  });

  it("clamps so the whole block stays inside the window at the bottom", () => {
    assert.deepEqual(
      movedTimes({ startMin: 15 * 60, endMin: 16 * 60, deltaMinutes: 600, ...WINDOW }),
      { startMin: 16 * 60, endMin: 17 * 60 },
    );
  });
});
