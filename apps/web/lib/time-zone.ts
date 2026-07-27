/**
 * Shared clock helpers for the family-facing surfaces. The family's own
 * IANA zone (migration #27) drives everything; Central time is the
 * fallback middle of a US-only audience for the moment before
 * TimeZoneSync captures a device zone.
 */

export const FALLBACK_TIME_ZONE = "America/Chicago";

export function effectiveTimeZone(stored: string | null | undefined): string {
  return stored || FALLBACK_TIME_ZONE;
}

/** Calendar date parts (year, month 1-12, day, weekday 0=Sun) for `now`
 * as seen in `timeZone`, without any date-library dependency. */
export function zonedDateParts(
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

function paddedDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function zonedDateString(now: Date, timeZone: string): string {
  const { year, month, day } = zonedDateParts(now, timeZone);
  return `${year}-${paddedDatePart(month)}-${paddedDatePart(day)}`;
}

export interface WeekdayCell {
  /** Short weekday label, "Mon" through "Fri". */
  label: string;
  /** Day of the month (1-31) as seen in the family's zone. */
  dayOfMonth: number;
  /** Calendar month (1-12) this cell falls in, e.g. a Dec 29-Jan 2
   * week's last two cells carry month 1. Added for D17 (birthday on
   * the board, plans/2026-07-21-chat-first-onboarding.md §4.2): a bare
   * day-of-month cannot tell a birthday match from any other month's
   * same day. */
  month: number;
  /** Calendar year this cell falls in, same year-boundary reasoning
   * as month above. */
  year: number;
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
    return {
      label,
      dayOfMonth: date.getUTCDate(),
      month: date.getUTCMonth() + 1,
      year: date.getUTCFullYear(),
      isToday: index === sinceMonday,
    };
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
