import { HOURS_SUBJECTS, type HoursLogRow, type HoursSource, type HoursSubject } from "../../lib/hours";
import type { ChildRecord } from "../../lib/family";

/**
 * Pure view-model helpers ported from apps/web/lib/hours-view.ts and
 * lib/time-zone.ts (the family-timezone slice). Deliberately unfinished
 * to match web (issue #174's own deferrals): no state minimum-hours
 * comparison (state_requirements has no hours field yet, so totals
 * render plainly, never "behind"), no splitting one block across
 * subjects, and hours_log's own ten-subject vocabulary is used as-is
 * rather than reconciled with the planner/MAP taxonomy.
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
  spanish: "Second language",
};

export const SOURCE_LABELS: Record<HoursSource, string> = {
  chat: "Chat",
  sms: "Text",
  call: "Phone call",
  email: "Email",
  dispatch: "Scheduled check-in",
};

export const FALLBACK_TIME_ZONE = "America/Chicago";

export function effectiveTimeZone(stored: string | null | undefined): string {
  return stored || FALLBACK_TIME_ZONE;
}

function zonedDateParts(now: Date, timeZone: string): { year: number; month: number; day: number; weekday: number } {
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

function paddedDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function zonedDateString(now: Date, timeZone: string): string {
  const { year, month, day } = zonedDateParts(now, timeZone);
  return `${year}-${paddedDatePart(month)}-${paddedDatePart(day)}`;
}

export interface HoursEntry {
  id: string;
  childId: string | null;
  childName: string | null;
  subject: HoursSubject;
  minutes: number;
  happenedOn: string;
  source: HoursSource;
  note: string | null;
}

export function toHoursEntries(rows: readonly HoursLogRow[], children: readonly ChildRecord[]): HoursEntry[] {
  const nameById = new Map(children.map((child) => [child.id, child.name]));
  return rows.map((row) => ({
    id: row.id,
    childId: row.childId,
    childName: row.childId ? (nameById.get(row.childId) ?? null) : null,
    subject: row.subject,
    minutes: row.minutes,
    happenedOn: row.happenedOn,
    source: row.source,
    note: row.note,
  }));
}

export function subjectOptions(entries: readonly HoursEntry[]): HoursSubject[] {
  const present = new Set(entries.map((entry) => entry.subject));
  return HOURS_SUBJECTS.filter((subject) => present.has(subject));
}

export function filterEntriesBySubject(
  entries: readonly HoursEntry[],
  subject: HoursSubject | null,
): HoursEntry[] {
  if (!subject) return [...entries];
  return entries.filter((entry) => entry.subject === subject);
}

export function filterEntriesByChild(entries: readonly HoursEntry[], childId: string | null): HoursEntry[] {
  if (!childId) return [...entries];
  return entries.filter((entry) => entry.childId === null || entry.childId === childId);
}

export interface HoursDayGroup {
  key: string;
  label: string;
  entries: HoursEntry[];
  totalMinutes: number;
}

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

/** One group per calendar day, newest first. Assumes entries already
 * arrive newest-happened_on-first (the query's own order). */
export function groupEntriesByDay(entries: readonly HoursEntry[], timeZone: string, now: Date): HoursDayGroup[] {
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

function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${paddedDatePart(month)}-${paddedDatePart(day)}`;
}

/** "schoolYear" is a fixed July 1 convention: state_requirements carries
 * no school-year start date today, a documented placeholder, not a
 * per-state calendar. */
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

/** A family-wide entry (childId null) counts toward every child's
 * total, per the hours_log schema comment ("co-op mornings count for
 * everyone"). */
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

/** "1h 30m", "45m", "2h", or "0m". Never a decimal hour: whole minutes
 * are the record's own unit. */
export function formatMinutesAsHours(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  if (safeMinutes === 0) return "0m";
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
