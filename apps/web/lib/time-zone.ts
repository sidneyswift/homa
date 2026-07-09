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
