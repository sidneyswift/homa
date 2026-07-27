import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FamilyEventRow } from "./family-events";
import type { PlanActivityScheduleRow } from "./plan-schedule";
import type { DashboardPlan } from "./plan-week";
import {
  buildCalendarBoard,
  calendarWeekDates,
  parseWeekOffset,
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
