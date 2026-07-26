import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import type { HoursLogRow } from "./hours";
import type { FamilyEventRow } from "./family-events";
import type { PlanActivityScheduleRow } from "./plan-schedule";
import type { DashboardPlan } from "./plan-week";
import { zonedDateParts } from "./time-zone";

/**
 * Pure view-model for /app/calendar (issue #176, CG-03: "calendar and
 * homeschool planner in one"), the unified surface a co-founder asked
 * for in her own words: "have an option for each kid and then a family
 * calendar... check off each kid's lessons, added homa lessons, family
 * subjects, related activities, appts etc." Same split as lib/hours-view.ts
 * and lib/plan-week.ts: everything here is a pure function over already
 * -fetched rows, so scoping, day-grouping, and lane assignment are
 * unit-testable without a browser or a database. page.tsx does the
 * auth-scoped reads (getFamilyEventsForFamily, getScheduledActivitiesForFamily,
 * getHoursLogForFamily) and hands the rows here.
 *
 * Week view only for this pass (month is a later extension, per the
 * ticket): a Monday-to-Sunday span, unlike the planner's Monday-to-Friday
 * board, because a family calendar has to hold a Saturday doctor's
 * appointment or a weekend camping trip.
 */

export interface CalendarDayCell {
  /** YYYY-MM-DD. */
  date: string;
  /** Short weekday label, "Mon" through "Sun". */
  label: string;
  dayOfMonth: number;
  month: number;
  year: number;
  isToday: boolean;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoFromUtcParts(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * calendarWeekDates(now, timeZone): the seven Monday-to-Sunday cells of
 * the current week in `timeZone`, with real calendar dates. Weekend
 * visits mark no cell "today", same reasoning as the planner's
 * weekdayCells: the board shows the week just lived.
 */
export function calendarWeekDates(now: Date, timeZone: string): CalendarDayCell[] {
  const { year, month, day, weekday } = zonedDateParts(now, timeZone);
  const sinceMonday = (weekday + 6) % 7;
  return WEEKDAY_LABELS.map((label, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - sinceMonday + index));
    return {
      date: isoFromUtcParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()),
      label,
      dayOfMonth: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
      isToday: index === sinceMonday,
    };
  });
}

export function subjectLabelFor(subjectId: string): string {
  if (subjectId === MONTH_PLAN_SUBJECT) return "The month";
  return getMapSubject(subjectId)?.displayName ?? subjectId;
}

export interface CalendarActivityItem {
  /** `${childId}:${subjectId}:${week}.${activityIndex}`, stable across
   * renders for React keys and for the existing plan-checks store. */
  key: string;
  childId: string;
  subjectId: string;
  subjectLabel: string;
  /** "week.activityIndex", the same key the existing plan-checks store
   * and PLAN_CHECK_KEY_RE use, so this reuses that check-off mechanism
   * rather than inventing a second one. */
  checkId: string;
  /** The activity's own text, read fresh from the plan every time (never
   * cached on the schedule row), so a stale or shifted schedule entry
   * can never show text that no longer matches the real plan. */
  text: string;
  done: boolean;
  /** The child's report token, the same identity usePlanChecks syncs
   * check-offs under on every other plan surface. Null on the rare
   * child-plans-without-a-report edge case; the component renders the
   * activity read-only rather than wiring a checkbox with no sync
   * identity to write to. */
  token: string | null;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  /** True when this event's range spans more than this one day. */
  multiDay: boolean;
}

export interface CalendarDayLane {
  date: string;
  activities: CalendarActivityItem[];
  events: CalendarEventItem[];
  /** Minutes of hours_log time recorded for this lane on this day (a
   * lightweight indicator; editing hours stays on /app/hours). */
  hoursMinutes: number;
}

export interface CalendarKidLane {
  childId: string;
  childName: string;
  /** Position in the FULL family roster (tone/avatar key), same rule as
   * PlannerView and HoursView: a kid keeps their color even when the
   * context switcher narrows the board to just them. */
  kidIndex: number;
  avatarUrl: string | null;
  days: CalendarDayLane[];
}

export interface CalendarBoard {
  days: CalendarDayCell[];
  kidLanes: CalendarKidLane[];
  /** Whole-family events only (child_id null); no per-kid activities or
   * hours belong here, those live on each kid's own lane. */
  familyDays: { date: string; events: CalendarEventItem[] }[];
}

export interface CalendarBoardKid {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface BuildCalendarBoardInput {
  /** The FULL family roster, always (see CalendarKidLane.kidIndex). */
  kids: readonly CalendarBoardKid[];
  plans: readonly DashboardPlan[];
  scheduledActivities: readonly PlanActivityScheduleRow[];
  familyEvents: readonly FamilyEventRow[];
  hoursEntries: readonly Pick<HoursLogRow, "childId" | "happenedOn" | "minutes">[];
  /** Each visible child's report token (the check-off sync identity
   * every other plan surface already uses), keyed by childId. */
  reportTokens: ReadonlyMap<string, string | null>;
  now: Date;
  timeZone: string;
  /** One kid selected in the context switcher, or null for everyone. */
  focusChildId: string | null;
}

function emptyDayLane(date: string): CalendarDayLane {
  return { date, activities: [], events: [], hoursMinutes: 0 };
}

/**
 * buildCalendarBoard(input): CalendarBoard
 * Merges three independent sources (scheduled plan activities, family
 * events, hours_log) into one week's per-kid lanes plus a family lane.
 * Every activity's text and done-state are read fresh from `plans` at
 * merge time; a plan_activity_schedule row whose (week, activityIndex)
 * no longer exists in the current plan is silently dropped rather than
 * shown with wrong or missing text (the documented known limitation in
 * the plan_activity_schedule migration: edit_plan's index shifting does
 * not yet cascade into this table).
 */
export function buildCalendarBoard(input: BuildCalendarBoardInput): CalendarBoard {
  const days = calendarWeekDates(input.now, input.timeZone);
  const dayDates = days.map((day) => day.date);
  const firstDate = dayDates[0];
  const lastDate = dayDates[dayDates.length - 1];

  const focusKid = input.focusChildId
    ? (input.kids.find((kid) => kid.id === input.focusChildId) ?? null)
    : null;
  const visibleKids = focusKid ? [focusKid] : input.kids;
  const visibleKidIds = new Set(visibleKids.map((kid) => kid.id));

  const planByKey = new Map<string, DashboardPlan>();
  for (const plan of input.plans) {
    planByKey.set(`${plan.childId}:${plan.subjectId}`, plan);
  }

  const kidLanes = new Map<string, CalendarKidLane>();
  input.kids.forEach((kid, kidIndex) => {
    if (!visibleKidIds.has(kid.id)) return;
    kidLanes.set(kid.id, {
      childId: kid.id,
      childName: kid.name,
      kidIndex,
      avatarUrl: kid.avatarUrl,
      days: dayDates.map((date) => emptyDayLane(date)),
    });
  });

  for (const row of input.scheduledActivities) {
    if (row.scheduledDate < firstDate || row.scheduledDate > lastDate) continue;
    const lane = kidLanes.get(row.childId);
    if (!lane) continue;
    const plan = planByKey.get(`${row.childId}:${row.subjectId}`);
    if (!plan) continue;
    const weekEntry = plan.weeks.find((week) => week.week === row.week);
    const text = weekEntry?.activities[row.activityIndex];
    // Out-of-bounds guard: the migration's documented known limitation.
    if (text === undefined) continue;
    const dayIndex = dayDates.indexOf(row.scheduledDate);
    if (dayIndex === -1) continue;
    const checkId = `${row.week}.${row.activityIndex}`;
    lane.days[dayIndex].activities.push({
      key: `${row.childId}:${row.subjectId}:${checkId}`,
      childId: row.childId,
      subjectId: row.subjectId,
      subjectLabel: subjectLabelFor(row.subjectId),
      checkId,
      text,
      done: Boolean(plan.progress[checkId]),
      token: input.reportTokens.get(row.childId) ?? null,
    });
  }

  const familyDays = dayDates.map((date) => ({ date, events: [] as CalendarEventItem[] }));
  const familyDaysByDate = new Map(familyDays.map((entry) => [entry.date, entry]));

  for (const event of input.familyEvents) {
    const item: CalendarEventItem = {
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      note: event.note,
      multiDay: event.startsOn !== event.endsOn,
    };
    for (const date of dayDates) {
      if (date < event.startsOn || date > event.endsOn) continue;
      if (event.childId === null) {
        familyDaysByDate.get(date)?.events.push(item);
      } else {
        kidLanes.get(event.childId)?.days.find((day) => day.date === date)?.events.push(item);
      }
    }
  }

  for (const entry of input.hoursEntries) {
    if (entry.happenedOn < firstDate || entry.happenedOn > lastDate) continue;
    if (entry.childId === null) {
      // Family-wide time (co-op mornings) counts toward every visible
      // kid's own day indicator, the same "counts for everyone"
      // convention hours_log's schema comment and computeChildTotals
      // (lib/hours-view.ts) already establish.
      for (const lane of kidLanes.values()) {
        const day = lane.days.find((entry2) => entry2.date === entry.happenedOn);
        if (day) day.hoursMinutes += entry.minutes;
      }
      continue;
    }
    const lane = kidLanes.get(entry.childId);
    if (!lane) continue;
    const day = lane.days.find((entry2) => entry2.date === entry.happenedOn);
    if (day) day.hoursMinutes += entry.minutes;
  }

  return {
    days,
    kidLanes: input.kids
      .filter((kid) => kidLanes.has(kid.id))
      .map((kid) => kidLanes.get(kid.id)!),
    familyDays,
  };
}
