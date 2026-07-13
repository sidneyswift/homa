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

/**
 * The chart's value law, shared with the agent's per-turn map snapshot
 * (2026-07-13 incident: the chart showed a parent "-9 mo" that the agent
 * could not see, so it disclaimed the family's own data). One function
 * decides which number a subject plots: the display months when the
 * subject has one, the REAL negative distance when the frontier sits
 * below age, and null when nothing measurable exists yet. Change it
 * here and every surface moves together; the parity test in
 * family-context-map-snapshot.test.ts holds them together.
 */
export function chartMonthsForScore(score: {
  monthsAhead: number | null;
  frontierDeltaMonths?: number | null;
}): number | null {
  if (score.monthsAhead !== null) return score.monthsAhead;
  const raw = score.frontierDeltaMonths ?? null;
  return raw !== null && raw < 0 ? raw : null;
}

/** "4\u00bd" style age from months, rounded to the nearest half year. */
export function ageAboutLabel(months: number): string {
  const half = Math.round(months / 6) / 2;
  const whole = Math.floor(half);
  return half === whole ? String(whole) : `${whole}\u00bd`;
}
