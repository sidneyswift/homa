import { zonedDateParts } from "./time-zone";

/**
 * Pure date and query helpers for the unified Planner. Calendar dates
 * stay as YYYY-MM-DD strings and use UTC only for arithmetic. The
 * family's time zone is consulted exactly once when deriving today.
 */

export const PLANNER_VIEWS = ["day", "week", "month", "hours"] as const;
export type PlannerViewMode = (typeof PLANNER_VIEWS)[number];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DATE_DISTANCE_DAYS = 731;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateFromDateOnly(value: string): Date | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function dateOnlyFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePlannerView(
  raw: string | string[] | undefined,
): PlannerViewMode {
  const value = firstQueryValue(raw);
  return PLANNER_VIEWS.includes(value as PlannerViewMode)
    ? (value as PlannerViewMode)
    : "day";
}

export function todayDateOnly(now: Date, timeZone: string): string {
  const { year, month, day } = zonedDateParts(now, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Invalid and extremely distant deep links return to today. */
export function parsePlannerDate(
  raw: string | string[] | undefined,
  today: string,
): string {
  const value = firstQueryValue(raw);
  const candidate = value ? dateFromDateOnly(value) : null;
  const todayDate = dateFromDateOnly(today);
  if (!candidate || !todayDate) return today;
  const distance = Math.abs(candidate.getTime() - todayDate.getTime()) / DAY_MS;
  return distance <= MAX_DATE_DISTANCE_DAYS ? value! : today;
}

export function addDaysDateOnly(value: string, days: number): string {
  const date = dateFromDateOnly(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnlyFromDate(date);
}

/** Adds a calendar month and clamps Jan 31 to the destination month. */
export function addMonthsDateOnly(value: string, months: number): string {
  const date = dateFromDateOnly(value);
  if (!date) return value;
  const day = date.getUTCDate();
  const destination = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(destination.getUTCFullYear(), destination.getUTCMonth() + 1, 0),
  ).getUTCDate();
  destination.setUTCDate(Math.min(day, lastDay));
  return dateOnlyFromDate(destination);
}

/** Monday through Sunday, matching the existing Planner week contract. */
export function weekRangeForDate(value: string): { start: string; end: string } {
  const date = dateFromDateOnly(value);
  if (!date) return { start: value, end: value };
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  const start = addDaysDateOnly(value, -sinceMonday);
  return { start, end: addDaysDateOnly(start, 6) };
}

export interface PlannerMonthCell {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
}

/** Familiar Sunday-first month grid, always five or six complete rows. */
export function monthCellsForDate(
  value: string,
  today: string,
): PlannerMonthCell[] {
  const date = dateFromDateOnly(value);
  if (!date) return [];
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const cells: PlannerMonthCell[] = [];
  for (
    let cursor = new Date(gridStart);
    cursor.getTime() <= gridEnd.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const cellDate = dateOnlyFromDate(cursor);
    cells.push({
      date: cellDate,
      dayOfMonth: cursor.getUTCDate(),
      inMonth: cursor.getUTCMonth() === date.getUTCMonth(),
      isToday: cellDate === today,
    });
  }
  return cells;
}

export function monthGridRangeForDate(
  value: string,
  today: string,
): { start: string; end: string } {
  const cells = monthCellsForDate(value, today);
  return {
    start: cells[0]?.date ?? value,
    end: cells[cells.length - 1]?.date ?? value,
  };
}

/** Offset passed into the existing Monday-first calendar board builder. */
export function weekOffsetDaysForDate(today: string, value: string): number {
  const todayStart = dateFromDateOnly(weekRangeForDate(today).start);
  const valueStart = dateFromDateOnly(weekRangeForDate(value).start);
  if (!todayStart || !valueStart) return 0;
  return Math.round((valueStart.getTime() - todayStart.getTime()) / DAY_MS);
}
