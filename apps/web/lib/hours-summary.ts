import { isValidDateOnly, schoolYearStartFor } from "./compliance/deadlines";
import { isHoursSubject, type HoursSubject } from "./hours-model";

/**
 * Shaping raw hours rows into an answer (gh#354).
 *
 * Pure functions so the tool stays a thin retrieval leaf and every rule
 * here is testable without a database. The tool owns tenancy and the
 * read; this file owns arithmetic, which is exactly the split the
 * placement law asks for: date math and totals never move into prose.
 */

export interface HoursRow {
  childId: string | null;
  subject: string;
  minutes: number;
  /** YYYY-MM-DD, the day the block happened, not a timestamp. */
  happenedOn: string;
  source: string;
  note: string | null;
}

export type HoursPeriod = "week" | "month" | "school_year" | "all";

/** Inclusive current-period start. An unset or invalid school-year date
 * has no lower bound; callers must label that window All time. */
export function periodStart(
  period: HoursPeriod,
  today: string,
  schoolYearStartOn: string | null = null,
): string | null {
  if (!isValidDateOnly(today)) throw new RangeError("Invalid current Hours date.");
  if (period === "all") return null;
  if (period === "school_year") return schoolYearStartFor(schoolYearStartOn, today);
  if (period === "month") return `${today.slice(0, 7)}-01`;
  const date = new Date(`${today}T00:00:00Z`);
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (weekday - 1));
  const start = date.toISOString().slice(0, 10);
  if (!isValidDateOnly(start)) throw new RangeError("Hours week is outside the supported calendar.");
  return start;
}

export function resolveHoursWindow(
  period: HoursPeriod,
  today: string,
  schoolYearStartOn: string | null = null,
) {
  const from = periodStart(period, today, schoolYearStartOn);
  const schoolYearFallback = period === "school_year" && from === null;
  return {
    from,
    through: today,
    period: schoolYearFallback ? "all" as const : period,
    schoolYearFallback,
    label: schoolYearFallback || period === "all" ? "All time" : period === "school_year" ? "School year" : period === "month" ? "This month" : "This week",
  };
}

/** Exact-count receipts catch both our cap and a lower PostgREST row cap. */
export function hoursReadIsComplete(totalCount: number | null, returned: number): boolean {
  return totalCount !== null && Number.isSafeInteger(totalCount) && totalCount >= 0
    && Number.isSafeInteger(returned) && returned >= 0 && totalCount === returned;
}

export interface HoursTotals {
  totalMinutes: number;
  byChild: { childId: string | null; minutes: number }[];
  bySubject: { subject: HoursSubject; minutes: number }[];
  entryCount: number;
  firstDay: string | null;
  lastDay: string | null;
}

export function summarizeHours(rows: readonly HoursRow[]): HoursTotals {
  const byChild = new Map<string | null, number>();
  const bySubject = new Map<HoursSubject, number>();
  let totalMinutes = 0;
  let firstDay: string | null = null;
  let lastDay: string | null = null;

  for (const row of rows) {
    totalMinutes += row.minutes;
    byChild.set(row.childId, (byChild.get(row.childId) ?? 0) + row.minutes);
    const subject: HoursSubject = isHoursSubject(row.subject)
      ? row.subject
      : "other";
    bySubject.set(subject, (bySubject.get(subject) ?? 0) + row.minutes);
    if (firstDay === null || row.happenedOn < firstDay) firstDay = row.happenedOn;
    if (lastDay === null || row.happenedOn > lastDay) lastDay = row.happenedOn;
  }

  const descending = <T>(entries: [T, number][]) =>
    entries.sort((left, right) => right[1] - left[1]);

  return {
    totalMinutes,
    byChild: descending([...byChild.entries()]).map(([childId, minutes]) => ({
      childId,
      minutes,
    })),
    bySubject: descending([...bySubject.entries()]).map(([subject, minutes]) => ({
      subject,
      minutes,
    })),
    entryCount: rows.length,
    firstDay,
    lastDay,
  };
}

/**
 * minutesBySubjectForChild(rows, childId, from): time logged for one
 * child this school year, one subject at a time (founder ruling
 * 2026-08-28: Hours time should be visible next to a subject's real
 * progress evidence, never blended into the score itself). Same
 * null-means-family-wide inclusion rule as scopedToViewContext
 * (apps/web/lib/hours-view.ts): a family-wide block (co-op, say) counts
 * for every child, exactly as it does on the Hours page itself.
 *
 * Display-only by design: the progress page looks this up by subjectId
 * and only "spanish" (Second language) has a matching value today,
 * since that is the one Hours subject chosen to line up 1:1 with the
 * real progress taxonomy (hours-model.ts). No other Hours subject is
 * assumed to map onto a taxonomy subject; this function does not
 * hardcode which subjects "count", it just sums whatever it is given.
 */
export function minutesBySubjectForChild(
  rows: readonly HoursRow[],
  childId: string,
  from: string | null,
  through?: string,
): Partial<Record<HoursSubject, number>> {
  const bySubject = new Map<HoursSubject, number>();
  for (const row of rows) {
    if (from !== null && row.happenedOn < from) continue;
    if (through !== undefined && row.happenedOn > through) continue;
    if (row.childId !== null && row.childId !== childId) continue;
    const subject: HoursSubject = isHoursSubject(row.subject) ? row.subject : "other";
    bySubject.set(subject, (bySubject.get(subject) ?? 0) + row.minutes);
  }
  return Object.fromEntries(bySubject);
}

/** Filters in code, never in the model's head. */
export function filterHours(
  rows: readonly HoursRow[],
  filters: { from: string | null; through?: string; childId?: string; subject?: string },
): HoursRow[] {
  return rows.filter((row) => {
    if (filters.from !== null && row.happenedOn < filters.from) return false;
    if (filters.through !== undefined && row.happenedOn > filters.through) return false;
    if (filters.childId !== undefined && row.childId !== filters.childId) {
      return false;
    }
    if (filters.subject !== undefined && row.subject !== filters.subject) {
      return false;
    }
    return true;
  });
}
