/**
 * Trajectory display formatting, dependency-free on purpose: the client
 * chart imports these, and pulling anything that touches the content
 * bank (@homa/core) into the browser bundle would ship the whole bank.
 */

/** "+10", "15+" for a capped floor, "-10" below age (founder ruling
 * 2026-07-13: real negative months, no euphemism slot). */
export function displayMonths(months: number, beyondScale: boolean): string {
  if (months < 0) return String(months);
  return beyondScale ? `${months}+` : `+${months}`;
}

/** "4\u00bd" style age from months, rounded to the nearest half year. */
export function ageAboutLabel(months: number): string {
  const half = Math.round(months / 6) / 2;
  const whole = Math.floor(half);
  return half === whole ? String(whole) : `${whole}\u00bd`;
}
