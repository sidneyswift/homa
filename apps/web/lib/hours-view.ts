import type { HoursLogRow, HoursSource } from "./hours";
import { HOURS_SUBJECTS, type HoursSubject } from "./hours-model";
import type { ChildRecord } from "./family";
import { zonedDateParts, zonedDateString } from "./time-zone";
import type { ViewContext } from "./view-context";

/**
 * Pure view-model helpers for the /app/hours page (CG-02, issue #174),
 * same split as lib/materials/binder.ts: page.tsx and hours.ts do the
 * auth-scoped reads, everything here is a pure function so scope,
 * grouping, filtering, and the running totals are unit-testable without
 * a browser or a database.
 *
 * Deferred out of this ticket on purpose (see the PR body / issue #174
 * for the follow-up tickets):
 *   1. State minimum-hours comparison: state_requirements has no hours
 *      field yet, so totals render plainly with no "behind" framing.
 *   2. Model-driven splitting of one logged block into multiple
 *      subjects: skill-layer judgment work, not this surface.
 *   3. Reconciling hours_log's coarse subject enum with the
 *      planner/MAP subject taxonomy: this page filters and labels
 *      hours_log's own ten subjects as-is.
 */

export const SUBJECT_LABELS: Record<HoursSubject, string> = {
  reading: "Reading",
  math: "Math",
  science: "Science",
  "social studies": "Social studies",
  art: "Art",
  music: "Music",
  PE: "PE",
  "co-op": "Co-op",
  "life skills": "Life skills",
  other: "Other",
};

export const SOURCE_LABELS: Record<HoursSource, string> = {
  chat: "Chat",
  sms: "Text",
  call: "Phone call",
};

export interface HoursEntry {
  id: string;
  childId: string | null;
  /** Resolved from the family's own children; null means family-wide
   * time (co-op mornings, per the hours_log schema comment), never a
   * lookup miss, since childId already came from the caller's own
   * RLS-scoped read. */
  childName: string | null;
  subject: HoursSubject;
  minutes: number;
  happenedOn: string;
  source: HoursSource;
  note: string | null;
}

/**
 * toHoursEntries(rows, children): HoursEntry[]
 * Attaches each row's child name, same pattern as toBinderMaterials.
 */
export function toHoursEntries(
  rows: readonly HoursLogRow[],
  children: readonly ChildRecord[],
): HoursEntry[] {
  const nameById = new Map(children.map((child) => [child.id, child.name]));
  return rows.map((row) => ({
    id: row.id,
    childId: row.childId,
    childName: row.childId ? nameById.get(row.childId) ?? null : null,
    subject: row.subject,
    minutes: row.minutes,
    happenedOn: row.happenedOn,
    source: row.source,
    note: row.note,
  }));
}

/**
 * scopedToViewContext(entries, viewContext): HoursEntry[]
 * Whole family sees everything; one kid's view keeps their own blocks
 * plus anything family-wide (childId null), same rule as the Binder.
 */
export function scopedToViewContext(
  entries: readonly HoursEntry[],
  viewContext: ViewContext,
): HoursEntry[] {
  if (viewContext.kind === "family") return [...entries];
  return entries.filter(
    (entry) => entry.childId === null || entry.childId === viewContext.childId,
  );
}

/**
 * subjectOptions(entries): HoursSubject[]
 * The subjects actually present, in the record's fixed vocabulary order
 * (never alphabetical or by count, same reasoning as the Binder's
 * kindOptions: a chip row that reorders itself as entries change would
 * feel unstable to scan).
 */
export function subjectOptions(entries: readonly HoursEntry[]): HoursSubject[] {
  const present = new Set(entries.map((entry) => entry.subject));
  return HOURS_SUBJECTS.filter((subject) => present.has(subject));
}

export interface HoursFilter {
  subject: HoursSubject | null;
}

export function isDefaultFilter(filter: HoursFilter): boolean {
  return filter.subject === null;
}

export function filterEntries(
  entries: readonly HoursEntry[],
  filter: HoursFilter,
): HoursEntry[] {
  if (!filter.subject) return [...entries];
  return entries.filter((entry) => entry.subject === filter.subject);
}

export interface HoursDayGroup {
  /** happened_on, YYYY-MM-DD. */
  key: string;
  label: string;
  entries: HoursEntry[];
  totalMinutes: number;
}

/**
 * dayLabel(dateOnly, timeZone, now): string
 * Today, Yesterday, or a dated weekday, same words as the tasks
 * History list. dateOnly is a bare calendar date (no time component),
 * so it's parsed at UTC noon-equivalent (Date.UTC with no time part)
 * and formatted with timeZone: "UTC" throughout, the same guard
 * weekSpanLabel uses to keep a calendar date's weekday stable
 * regardless of the renderer's own clock.
 */
export function dayLabel(dateOnly: string, timeZone: string, now: Date): string {
  const today = zonedDateString(now, timeZone);
  const yesterday = zonedDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000), timeZone);
  if (dateOnly === today) return "Today";
  if (dateOnly === yesterday) return "Yesterday";
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * groupEntriesByDay(entries, timeZone, now): HoursDayGroup[]
 * One group per calendar day, newest day first. Assumes entries already
 * arrive newest-happened_on-first (the query's own order), same
 * "already sorted" contract as tasks' groupRunsByDay.
 */
export function groupEntriesByDay(
  entries: readonly HoursEntry[],
  timeZone: string,
  now: Date,
): HoursDayGroup[] {
  const groups: HoursDayGroup[] = [];
  for (const entry of entries) {
    const current = groups[groups.length - 1];
    if (current && current.key === entry.happenedOn) {
      current.entries.push(entry);
      current.totalMinutes += entry.minutes;
      continue;
    }
    groups.push({
      key: entry.happenedOn,
      label: dayLabel(entry.happenedOn, timeZone, now),
      entries: [entry],
      totalMinutes: entry.minutes,
    });
  }
  return groups;
}

export type HoursPeriod = "week" | "month" | "schoolYear";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * periodStart(period, now, timeZone): YYYY-MM-DD
 * The first day of the running-total window, in the family's own zone.
 * "schoolYear" is a fixed July 1 convention: state_requirements carries
 * no school-year start date today (deferral #1 above), so this is a
 * documented placeholder good enough for a first running total, not a
 * per-state calendar.
 */
export function periodStart(period: HoursPeriod, now: Date, timeZone: string): string {
  const { year, month, day, weekday } = zonedDateParts(now, timeZone);
  if (period === "week") {
    const sinceMonday = (weekday + 6) % 7;
    const date = new Date(Date.UTC(year, month - 1, day - sinceMonday));
    return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  if (period === "month") {
    return isoFromParts(year, month, 1);
  }
  const schoolYearStartYear = month >= 7 ? year : year - 1;
  return isoFromParts(schoolYearStartYear, 7, 1);
}

export interface ChildHoursTotals {
  childId: string;
  childName: string;
  week: number;
  month: number;
  schoolYear: number;
}

/**
 * computeChildTotals(entries, children, now, timeZone): ChildHoursTotals[]
 * One row per child, straightforward GROUP BY arithmetic (no
 * materialized view needed for v1, per the ticket): a family-wide entry
 * (childId null) counts toward every child's total, exactly as the
 * hours_log schema comment documents ("co-op mornings count for
 * everyone"). Pass an already subject-filtered `entries` list to get
 * subject-scoped totals; pass the full list for "every subject".
 */
export function computeChildTotals(
  entries: readonly HoursEntry[],
  children: readonly { id: string; name: string }[],
  now: Date,
  timeZone: string,
): ChildHoursTotals[] {
  const weekStart = periodStart("week", now, timeZone);
  const monthStart = periodStart("month", now, timeZone);
  const schoolYearStart = periodStart("schoolYear", now, timeZone);
  return children.map((child) => {
    let week = 0;
    let month = 0;
    let schoolYear = 0;
    for (const entry of entries) {
      if (entry.childId !== null && entry.childId !== child.id) continue;
      if (entry.happenedOn < schoolYearStart) continue;
      schoolYear += entry.minutes;
      if (entry.happenedOn >= monthStart) month += entry.minutes;
      if (entry.happenedOn >= weekStart) week += entry.minutes;
    }
    return { childId: child.id, childName: child.name, week, month, schoolYear };
  });
}

/**
 * formatMinutesAsHours(totalMinutes): string
 * "1h 30m", "45m", "2h", or "0m". Never a decimal hour: whole minutes
 * are the record's own unit (the check constraint is 1 to 600 minutes),
 * so a compact hours-and-minutes label reads truer than rounding.
 */
export function formatMinutesAsHours(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  if (safeMinutes === 0) return "0m";
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
