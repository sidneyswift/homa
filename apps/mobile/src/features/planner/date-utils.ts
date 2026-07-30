/**
 * Calendar-date (not instant) math for the Planner, working entirely in
 * plain "YYYY-MM-DD" strings. family_events/plan_activity_schedule store
 * dates this way with no time zone, so this deliberately never routes
 * through a JS Date's local-time interpretation (new Date("2026-07-29")
 * parses as UTC midnight, which shifts to the previous day once
 * formatted through a negative-UTC-offset local clock), so every value
 * here is a "day number since the epoch," immune to that entire class
 * of off-by-one bug.
 */

const MS_PER_DAY = 86_400_000;
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type DateOnly = string;

function toDayNumber(date: DateOnly): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function fromDayNumber(dayNumber: number): DateOnly {
  const date = new Date(dayNumber * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDateOnly(): DateOnly {
  const now = new Date();
  return fromDayNumber(Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY));
}

export function addDays(date: DateOnly, amount: number): DateOnly {
  return fromDayNumber(toDayNumber(date) + amount);
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return toDayNumber(a) - toDayNumber(b);
}

export function isSameDate(a: DateOnly, b: DateOnly): boolean {
  return a === b;
}

/** Monday of the week containing this date (Mon–Sun grid, matching web's calendar). */
export function startOfWeek(date: DateOnly): DateOnly {
  const day = new Date(toDayNumber(date) * MS_PER_DAY).getUTCDay();
  const offsetFromMonday = day === 0 ? 6 : day - 1;
  return addDays(date, -offsetFromMonday);
}

export function startOfMonth(date: DateOnly): DateOnly {
  const [year, month] = date.split("-");
  return `${year}-${month}-01`;
}

export function addMonths(date: DateOnly, amount: number): DateOnly {
  const [year, month, day] = date.split("-").map(Number);
  const targetMonthIndex = month - 1 + amount;
  const targetDate = new Date(Date.UTC(year, targetMonthIndex, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);
  return fromDayNumber(
    Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), clampedDay) / MS_PER_DAY,
  );
}

/** Inclusive list of every date from start to end. */
export function daysInRange(start: DateOnly, end: DateOnly): DateOnly[] {
  const startDay = toDayNumber(start);
  const endDay = toDayNumber(end);
  const days: DateOnly[] = [];
  for (let day = startDay; day <= endDay; day += 1) {
    days.push(fromDayNumber(day));
  }
  return days;
}

/** The 6x7 grid a month view renders: full weeks, Monday-first, spanning the month. */
export function monthGridRange(anchorDate: DateOnly): { start: DateOnly; end: DateOnly } {
  const monthStart = startOfMonth(anchorDate);
  const nextMonthStart = addMonths(monthStart, 1);
  const monthEnd = addDays(nextMonthStart, -1);
  return { start: startOfWeek(monthStart), end: addDays(startOfWeek(monthEnd), 6) };
}

function weekdayIndex(date: DateOnly): number {
  return new Date(toDayNumber(date) * MS_PER_DAY).getUTCDay();
}

export function formatWeekdayShort(date: DateOnly): string {
  return WEEKDAY_SHORT[weekdayIndex(date)];
}

export function formatWeekdayLong(date: DateOnly): string {
  return WEEKDAY_LONG[weekdayIndex(date)];
}

/** "Wednesday, Jul 29, 2026", the day view's header. */
export function formatFullDate(date: DateOnly): string {
  const [year] = date.split("-");
  return `${formatWeekdayLong(date)}, ${formatMonthDay(date)}, ${year}`;
}

export function formatMonthDay(date: DateOnly): string {
  const [, month, day] = date.split("-").map(Number);
  return `${MONTH_SHORT[month - 1]} ${day}`;
}

export function formatMonthYear(date: DateOnly): string {
  const [year, month] = date.split("-").map(Number);
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

export function dayOfMonth(date: DateOnly): number {
  return Number(date.split("-")[2]);
}

export function isSameMonth(date: DateOnly, anchorDate: DateOnly): boolean {
  return date.slice(0, 7) === anchorDate.slice(0, 7);
}

/** "Jul 21–27, 2026" or "Jul 28 – Aug 3, 2026" for a Mon–Sun week label. */
export function formatWeekRangeLabel(weekStart: DateOnly): string {
  const weekEnd = addDays(weekStart, 6);
  const [startYear, startMonth, startDay] = weekStart.split("-").map(Number);
  const [endYear, endMonth, endDay] = weekEnd.split("-").map(Number);
  if (startMonth === endMonth) {
    return `${MONTH_SHORT[startMonth - 1]} ${startDay}–${endDay}, ${endYear}`;
  }
  if (startYear === endYear) {
    return `${MONTH_SHORT[startMonth - 1]} ${startDay} – ${MONTH_SHORT[endMonth - 1]} ${endDay}, ${endYear}`;
  }
  return `${MONTH_SHORT[startMonth - 1]} ${startDay}, ${startYear} – ${MONTH_SHORT[endMonth - 1]} ${endDay}, ${endYear}`;
}
