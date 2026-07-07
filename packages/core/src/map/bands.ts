/**
 * Age math for the child's map (lead magnet v2).
 * Ages are handled in whole months everywhere; birth dates arrive as
 * "YYYY-MM-DD" (the real day, founder call 2026-07-06: "get the actual
 * birthday, not just month and year"). ageInMonths also accepts a bare
 * "YYYY-MM" (day omitted) for callers that only ever had month precision
 * (the pinned sample report), falling back to the same whole-month math
 * as before.
 */

/** Scored range: 2y0m up to (not including) 17y0m, so every age 2 to 16
 * gets a checklist. Under-2s are captured with the pending-band promise. */
export const SCORED_MIN_MONTHS = 24;
export const SCORED_MAX_MONTHS = 204;

/** Hard cap on how far ahead a single domain can read, per the position rubric. */
export const MONTHS_AHEAD_CAP = 24;

/** Capture floor: under this age we do not even collect a child. */
export const CAPTURE_MIN_MONTHS = 0;
/** Capture ceiling for the lead magnet: 16 years. */
export const CAPTURE_MAX_MONTHS = 17 * 12;

const BIRTH_DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** True for a real calendar date (rejects e.g. 2024-02-30) within a
 * plausible 18-year window, not just a well-formed pattern. */
export function isValidBirthDate(value: string): boolean {
  const match = BIRTH_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const thisYear = new Date().getUTCFullYear();
  if (year < thisYear - 18 || year > thisYear) return false;
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  );
}

/** Whole months of age for a "YYYY-MM-DD" (or bare "YYYY-MM") birth date
 * as of `now`, precise to the day: a child isn't credited with a whole
 * month until the calendar has actually reached their birth day. */
export function ageInMonths(birthDate: string, now: Date = new Date()): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  let months = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
  if (day && now.getUTCDate() < day) months -= 1;
  return Math.max(0, months);
}

/** True when the child's age falls inside the currently scored bands. */
export function isInScoredRange(months: number): boolean {
  return months >= SCORED_MIN_MONTHS && months < SCORED_MAX_MONTHS;
}

/** "4y 2m" style label for display. */
export function ageLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years}y` : `${years}y ${rest}m`;
}
