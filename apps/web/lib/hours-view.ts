import { periodStart as hoursPeriodStart } from "./hours-summary";
import type { HoursLogRow, HoursSource } from "./hours";
import { HOURS_SUBJECTS, type HoursSubject } from "./hours-model";
import type { ChildRecord } from "./family";
import { zonedDateString } from "./time-zone";
import type { ViewContext } from "./view-context";

/**
 * Pure view-model helpers for the Planner Hours view (CG-02, issue #174),
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
  reading: "Language arts",
  math: "Math",
  science: "Science",
  "social studies": "History and social studies",
  art: "Art",
  music: "Music",
  PE: "PE",
  "co-op": "Co-op",
  "life skills": "Life skills",
  other: "Other",
  spanish: "Foreign language",
};

export const SOURCE_LABELS: Record<HoursSource, string> = {
  chat: "Chat",
  sms: "Text",
  call: "Phone call",
  email: "Email",
  dispatch: "Scheduled check-in",
};

const HOURS_SUBJECT_TONES: ReadonlyArray<readonly [string, string]> = [
  ["var(--homa-error-tint)", "var(--homa-brand-text)"],
  ["var(--homa-constructive-tint)", "var(--homa-constructive-ink)"],
  ["var(--homa-highlight-tint)", "var(--homa-highlight-ink)"],
  ["var(--homa-info-tint)", "var(--homa-info-ink)"],
];

/** One stable, design-system tone per hours subject. Shared by the compact
 * Day summary and the editable Hours record. */
export function hoursSubjectTone(subject: HoursSubject): readonly [string, string] {
  const index = Math.max(0, HOURS_SUBJECTS.indexOf(subject));
  return HOURS_SUBJECT_TONES[index % HOURS_SUBJECT_TONES.length];
}

export interface HoursEntry {
  id: string;
  childId: string | null;
  /** Resolved from the family's own children; null means family-wide
   * time (co-op mornings, per the hours_log schema comment), never a
   * lookup miss, since childId already came from the caller's own
   * RLS-scoped read. */
  childName: string | null;
  subject: HoursSubject;
  /** Her own word for this block ("Literature journal"), under any
   * subject; null until she sets one. Use subjectDisplayLabel to render,
   * never this field or SUBJECT_LABELS alone. */
  customLabel: string | null;
  minutes: number;
  happenedOn: string;
  source: HoursSource;
  note: string | null;
}

/**
 * subjectDisplayLabel(entry): string
 * Shows the parent subject alongside her category when she has set one.
 * The subject filter chips and "nothing logged for
 * X yet" copy stay on SUBJECT_LABELS directly on purpose: those describe
 * the fixed bucket, not one entry.
 */
export function subjectDisplayLabel(entry: Pick<HoursEntry, "subject" | "customLabel">): string {
  if (entry.customLabel) return `${SUBJECT_LABELS[entry.subject]} · ${entry.customLabel}`;
  return SUBJECT_LABELS[entry.subject];
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
    customLabel: row.customLabel,
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
  category?: string | null;
}

/** Day and Week use the same recorded-day and child-plus-family scope. */
export function recordedHoursForDate(
  entries: readonly HoursEntry[],
  date: string,
  childId: string | null,
): HoursEntry[] {
  return entries.filter((entry) => entry.happenedOn === date
    && (childId === null || entry.childId === null || entry.childId === childId));
}

export function isDefaultFilter(filter: HoursFilter): boolean {
  return filter.subject === null;
}

export function filterEntries(
  entries: readonly HoursEntry[],
  filter: HoursFilter,
): HoursEntry[] {
  return entries.filter((entry) => (!filter.subject || entry.subject === filter.subject)
    && (filter.category === undefined || entry.customLabel === filter.category));
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

/** Current windows use the family's timezone and saved school-year anniversary. */
export function periodStart(
  period: HoursPeriod,
  now: Date,
  timeZone: string,
  schoolYearStartOn: string | null = null,
): string | null {
  return hoursPeriodStart(period === "schoolYear" ? "school_year" : period, zonedDateString(now, timeZone), schoolYearStartOn);
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
  schoolYearStartOn: string | null = null,
): ChildHoursTotals[] {
  const weekStart = periodStart("week", now, timeZone)!;
  const monthStart = periodStart("month", now, timeZone)!;
  const schoolYearStart = periodStart("schoolYear", now, timeZone, schoolYearStartOn);
  const today = zonedDateString(now, timeZone);
  return children.map((child) => {
    let week = 0;
    let month = 0;
    let schoolYear = 0;
    for (const entry of entries) {
      if (entry.childId !== null && entry.childId !== child.id) continue;
      if (entry.happenedOn > today) continue;
      if (schoolYearStart === null || entry.happenedOn >= schoolYearStart) schoolYear += entry.minutes;
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
