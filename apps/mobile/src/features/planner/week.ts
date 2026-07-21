/**
 * Pure clock and pacing helpers for the week board, ported from
 * apps/web/lib/time-zone.ts and apps/web/app/app/planner/spread-week.ts
 * (keep in sync until a shared package exists). The family's own IANA
 * zone drives everything; Central time is the fallback middle of a
 * US-only audience for the moment before TimeZoneSync captures a
 * device zone.
 */

export const FALLBACK_TIME_ZONE = "America/Chicago";

export function effectiveTimeZone(stored: string | null | undefined): string {
  return stored || FALLBACK_TIME_ZONE;
}

/** Calendar date parts (year, month 1-12, day, weekday 0=Sun) for `now`
 * as seen in `timeZone`, without any date-library dependency. */
function zonedDateParts(
  now: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

export interface WeekdayCell {
  /** Short weekday label, "Mon" through "Fri". */
  label: string;
  /** Day of the month (1-31) as seen in the family's zone. */
  dayOfMonth: number;
  isToday: boolean;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

/**
 * The five Monday-to-Friday cells of the current week in `timeZone`,
 * for the planner's calendar board. Weekend visits mark no cell as
 * today: the board shows the week just lived, same as weekSpanLabel.
 */
export function weekdayCells(now: Date, timeZone: string): WeekdayCell[] {
  const { year, month, day, weekday } = zonedDateParts(now, timeZone);
  const sinceMonday = (weekday + 6) % 7;
  return WEEKDAY_LABELS.map((label, index) => {
    // Date.UTC normalizes day-of-month underflow across month edges.
    const date = new Date(Date.UTC(year, month - 1, day - sinceMonday + index));
    return { label, dayOfMonth: date.getUTCDate(), isToday: index === sinceMonday };
  });
}

/**
 * The Monday-to-Friday span of the current week in `timeZone`, e.g.
 * "Jul 6 to 10" (or "Jun 29 to Jul 3" across a month edge). Weekend
 * visits show the week just lived, matching how families talk about
 * "this week" on a Saturday.
 */
export function weekSpanLabel(now: Date, timeZone: string): string {
  const { year, month, day, weekday } = zonedDateParts(now, timeZone);
  // Days since Monday (Sunday counts as the end of the prior week).
  const sinceMonday = (weekday + 6) % 7;
  const monday = new Date(Date.UTC(year, month - 1, day - sinceMonday));
  const friday = new Date(Date.UTC(year, month - 1, day - sinceMonday + 4));
  const shortDate = (date: Date, withMonth: boolean) =>
    withMonth
      ? `${date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${date.getUTCDate()}`
      : String(date.getUTCDate());
  const sameMonth = monday.getUTCMonth() === friday.getUTCMonth();
  return `${shortDate(monday, true)} to ${shortDate(friday, !sameMonth)}`;
}

/**
 * spreadAcrossWeekdays(count: number): number[]
 * Deterministic day slots (0 = Mon .. 4 = Fri) for a kid's `count`
 * activities this week. A few activities spread out evenly (1 lands
 * Monday; 2 land Mon/Fri; 3 land Mon/Wed/Fri; 4 skip the midweek dip),
 * and more than five round-robin so every day stays light. Presentation
 * only: checks stay keyed by plan ("week.activityIndex"), never by day,
 * because real day scheduling is the M2-10 milestone, not this board.
 */
export function spreadAcrossWeekdays(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count <= 5) {
    return Array.from({ length: count }, (_, index) =>
      Math.round((index * 4) / (count - 1)),
    );
  }
  return Array.from({ length: count }, (_, index) => index % 5);
}
