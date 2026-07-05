/**
 * Age math for the child's map (lead magnet v2).
 * Ages are handled in whole months everywhere; birth dates arrive as
 * "YYYY-MM" (day is never collected, matching public.children.birth_month).
 */

/** Scored range for v1: 2y0m up to (not including) 7y0m. */
export const SCORED_MIN_MONTHS = 24;
export const SCORED_MAX_MONTHS = 84;

/** Hard cap on how far ahead a single domain can read, per the position rubric. */
export const MONTHS_AHEAD_CAP = 24;

/** Capture floor: under this age we do not even collect a child. */
export const CAPTURE_MIN_MONTHS = 0;
/** Capture ceiling for the lead magnet: 16 years. */
export const CAPTURE_MAX_MONTHS = 17 * 12;

const BIRTH_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidBirthMonth(value: string): boolean {
  if (!BIRTH_MONTH_PATTERN.test(value)) return false;
  const [year] = value.split("-").map(Number);
  const thisYear = new Date().getUTCFullYear();
  return year >= thisYear - 18 && year <= thisYear;
}

/** Whole months of age for a "YYYY-MM" birth month as of `now`. */
export function ageInMonths(birthMonth: string, now: Date = new Date()): number {
  const [year, month] = birthMonth.split("-").map(Number);
  const months = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
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
