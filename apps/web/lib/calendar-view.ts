import { getMapSubject, MONTH_PLAN_SUBJECT } from "@homa/core";

import type { HoursLogRow } from "./hours";
import type { FamilyEventRow } from "./family-events";
import {
  expandRecurringFamilyEvents,
  familyEventChildIds,
} from "./family-events-model";
import type { PlanActivityScheduleRow } from "./plan-schedule";
import type { DashboardPlan } from "./plan-week";
import { zonedDateParts } from "./time-zone";

/**
 * Pure view-model for Planner calendar views (issue #176, CG-03: "calendar and
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

/** Deep-linking guardrail for the `?week=` search param, not a security
 * boundary (this only shifts which week the caller's own data renders):
 * clamp to two years either side so a malformed or wild value can't
 * produce a pathological date computation. */
export const MAX_WEEK_OFFSET = 104;

/** parseWeekOffset(raw): the whole-week offset from the `?week=` search
 * param (0 = this week), clamped to MAX_WEEK_OFFSET either way. Missing
 * or non-numeric input is "this week", never a crash. */
export function parseWeekOffset(raw: string | undefined): number {
  const parsed = raw === undefined ? 0 : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-MAX_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, parsed));
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
 * calendarWeekDates(now, timeZone, weekOffsetDays): the seven
 * Monday-to-Sunday cells of the week `weekOffsetDays` away from the
 * current one (0 = this week, 7 = next week, -7 = last week; the
 * navigation controls in calendar-view.tsx pass whole-week multiples).
 * `isToday` always compares against the real, un-shifted today, so
 * paging to another week correctly marks no cell "today" rather than
 * re-deriving "today" from a shifted date.
 */
export function calendarWeekDates(
  now: Date,
  timeZone: string,
  weekOffsetDays = 0,
): CalendarDayCell[] {
  const { year, month, day, weekday } = zonedDateParts(now, timeZone);
  const todayIso = isoFromUtcParts(year, month, day);
  const sinceMonday = (weekday + 6) % 7;
  return WEEKDAY_LABELS.map((label, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - sinceMonday + index + weekOffsetDays));
    const iso = isoFromUtcParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    return {
      date: iso,
      label,
      dayOfMonth: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
      isToday: iso === todayIso,
    };
  });
}

export function subjectLabelFor(subjectId: string): string {
  if (subjectId === MONTH_PLAN_SUBJECT) return "The month";
  return getMapSubject(subjectId)?.displayName ?? subjectId;
}

/** timeToMinutes("14:00" or "14:00:00"): minutes since midnight. Returns
 * null on anything unparseable rather than NaN propagating into layout
 * math. */
export function timeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** minutesToTimeInput(510) -> "08:30": the HH:MM a native time input
 * (and parseFamilyEventInput's TIME_RE) expects. Clamped to one day. */
export function minutesToTimeInput(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** Snaps a tap on the time grid to the nearest half hour, the way a
 * parent thinks about appointments ("3:30", never "3:23"). */
export function snapToHalfHour(minutes: number): number {
  return Math.round(minutes / 30) * 30;
}

/**
 * movedTimes(...): where a dragged event lands. The duration is
 * preserved (dragging moves an appointment, it never resizes it), the
 * new start snaps to the half hour a parent actually says out loud, and
 * the whole block is clamped inside the visible window so a drag can
 * never park an event off the grid it was dragged on.
 */
export function movedTimes(input: {
  startMin: number;
  endMin: number;
  deltaMinutes: number;
  windowStartHour: number;
  windowEndHour: number;
}): { startMin: number; endMin: number } {
  const duration = input.endMin - input.startMin;
  const windowStart = input.windowStartHour * 60;
  const windowEnd = input.windowEndHour * 60;
  const snapped = snapToHalfHour(input.startMin + input.deltaMinutes);
  const latestStart = Math.max(windowStart, windowEnd - duration);
  const startMin = Math.max(windowStart, Math.min(latestStart, snapped));
  return { startMin, endMin: startMin + duration };
}

function clock(minutes: number, withMeridiem: boolean): string {
  const hours24 = Math.floor(minutes / 60) % 24;
  const hours12 = ((hours24 + 11) % 12) + 1;
  const mins = minutes % 60;
  const body = mins === 0 ? `${hours12}` : `${hours12}:${String(mins).padStart(2, "0")}`;
  if (!withMeridiem) return body;
  return `${body} ${hours24 < 12 ? "AM" : "PM"}`;
}

/** formatTimeRange("14:00", "15:00") -> "2 to 3 PM"; the shared-meridiem
 * form drops the first AM/PM the way a parent would say it out loud, and
 * a missing end time falls back to just the start. */
export function formatTimeRange(start: string, end: string | null): string {
  const startMin = timeToMinutes(start);
  if (startMin === null) return "";
  const endMin = end === null ? null : timeToMinutes(end);
  if (endMin === null) return clock(startMin, true);
  const sameMeridiem = startMin < 720 === endMin < 720;
  return sameMeridiem
    ? `${clock(startMin, false)} to ${clock(endMin, true)}`
    : `${clock(startMin, true)} to ${clock(endMin, true)}`;
}

/**
 * bannerWhenLabel(...): the all-day strip's "when" text. A multi-day
 * event's start_time/end_time are a first-day-only window (migration
 * 20260726130000), so a timed multi-day event must NOT read "all day"
 * (issue #256): when its first day is in view, the label carries the
 * first-day time range instead. When the visible slice starts after the
 * event's own first day, the days on screen genuinely have no time
 * window, so "all day" stays honest there.
 */
export function bannerWhenLabel(input: {
  /** "Wed 5": the banner's first visible day. */
  startDayLabel: string;
  /** "Sun 9": the banner's last visible day. */
  endDayLabel: string;
  /** False when the banner occupies a single day cell this week. */
  spansMultipleCells: boolean;
  /** True when the event's own starts_on is one of the visible days. */
  firstDayInView: boolean;
  startTime: string | null;
  endTime: string | null;
}): string {
  const span = input.spansMultipleCells
    ? `${input.startDayLabel} to ${input.endDayLabel}`
    : input.startDayLabel;
  const range =
    input.startTime !== null && input.firstDayInView
      ? formatTimeRange(input.startTime, input.endTime)
      : "";
  if (range === "") return `${span}, all day`;
  return input.spansMultipleCells
    ? `${span}, ${range} on the first day`
    : `${span}, ${range}`;
}

export interface TimedSpan {
  startMin: number;
  endMin: number;
}

/**
 * layoutTimedItems(items): assigns each timed item a slot within its
 * overlap cluster so concurrent events render side by side instead of
 * stacked on top of each other (two kids' Friday classes at 4:00 and
 * 4:30). slotCount is the cluster's width divisor: every member of one
 * overlapping cluster shares it so the columns line up.
 */
export function layoutTimedItems<T extends TimedSpan>(
  items: readonly T[],
): (T & { slot: number; slotCount: number })[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const placed: (T & { slot: number; slotCount: number })[] = [];
  let cluster: (T & { slot: number; slotCount: number })[] = [];
  let clusterEnd = -1;
  let slotEnds: number[] = [];
  const closeCluster = () => {
    for (const member of cluster) member.slotCount = slotEnds.length;
  };
  for (const item of sorted) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) {
      closeCluster();
      cluster = [];
      slotEnds = [];
      clusterEnd = -1;
    }
    let slot = slotEnds.findIndex((end) => end <= item.startMin);
    if (slot === -1) {
      slot = slotEnds.length;
      slotEnds.push(item.endMin);
    } else {
      slotEnds[slot] = item.endMin;
    }
    const placedItem = { ...item, slot, slotCount: 1 };
    cluster.push(placedItem);
    placed.push(placedItem);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  closeCluster();
  return placed;
}

/** The time grid's visible hour window: a school-day 8 to 5 by default,
 * expanded (never shrunk) to fit whatever is actually scheduled. */
export function timedWindow(items: readonly TimedSpan[]): {
  startHour: number;
  endHour: number;
} {
  let startHour = 8;
  let endHour = 17;
  for (const item of items) {
    startHour = Math.min(startHour, Math.floor(item.startMin / 60));
    endHour = Math.max(endHour, Math.ceil(item.endMin / 60));
  }
  return { startHour, endHour };
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
   * lightweight indicator; editing hours stays in Planner's Hours view). */
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
  /** Whole-family events only (no explicit child links); no per-kid
   * activities or hours belong here, those live on each kid's own lane. */
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
  now: Date;
  timeZone: string;
  /** One kid selected in the context switcher, or null for everyone. */
  focusChildId: string | null;
  /** Which week to show, in whole days from the current one (0 = this
   * week). Same param calendarWeekDates takes; see its comment. */
  weekOffsetDays?: number;
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
  const days = calendarWeekDates(input.now, input.timeZone, input.weekOffsetDays ?? 0);
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
    });
  }

  const familyDays = dayDates.map((date) => ({ date, events: [] as CalendarEventItem[] }));
  const familyDaysByDate = new Map(familyDays.map((entry) => [entry.date, entry]));

  for (const event of expandRecurringFamilyEvents(input.familyEvents, firstDate, lastDate)) {
    const eventChildIds = familyEventChildIds(event);
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
      if (eventChildIds.length === 0) {
        familyDaysByDate.get(date)?.events.push(item);
      } else {
        for (const childId of eventChildIds) {
          kidLanes.get(childId)?.days.find((day) => day.date === date)?.events.push(item);
        }
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
