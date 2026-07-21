/**
 * Trajectory display formatting, ported verbatim from
 * apps/web/lib/map/trajectory-format.ts (keep in sync). Pure and
 * dependency-free: one function decides which number a subject plots so
 * the chart, the caption, and the agent can never disagree.
 */

/** "+10", "15+" for a capped floor, "-10" below age (founder ruling
 * 2026-07-13: real negative months, no euphemism slot). */
export function displayMonths(months: number, beyondScale: boolean): string {
  if (months < 0) return String(months);
  return beyondScale ? `${months}+` : `+${months}`;
}

/**
 * The chart's value law: the display months when the subject has one,
 * the REAL negative distance when the frontier sits below age, and null
 * when nothing measurable exists yet (web twin's comment records the
 * 2026-07-13 incident this law fixed).
 */
export function chartMonthsForScore(score: {
  monthsAhead: number | null;
  frontierDeltaMonths?: number | null;
}): number | null {
  if (score.monthsAhead !== null) return score.monthsAhead;
  const raw = score.frontierDeltaMonths ?? null;
  return raw !== null && raw < 0 ? raw : null;
}

/** "4½" style age from months, rounded to the nearest half year. */
export function ageAboutLabel(months: number): string {
  const half = Math.round(months / 6) / 2;
  const whole = Math.floor(half);
  return half === whole ? String(whole) : `${whole}½`;
}
