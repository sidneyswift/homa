import type { FamilyEventRecord } from "../../lib/family-events";
import { addDays, compareDateOnly, type DateOnly } from "./date-utils";

function weekday(date: DateOnly): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function daysBetween(from: DateOnly, to: DateOnly): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function dateIsOccurrence(event: FamilyEventRecord, date: DateOnly): boolean {
  const rule = event.recurrence_rule;
  if (!rule || date < event.starts_on || (rule.until && date > rule.until)) return false;
  const elapsedDays = daysBetween(event.starts_on, date);
  return Math.floor(elapsedDays / 7) % rule.interval === 0
    && rule.weekdays.includes(weekday(date));
}

/** Expands one stored weekly series only inside the requested Planner window. */
export function expandRecurringFamilyEvents(
  events: FamilyEventRecord[],
  rangeStart: DateOnly,
  rangeEnd: DateOnly,
): FamilyEventRecord[] {
  const expanded: FamilyEventRecord[] = [];
  for (const event of events) {
    const rule = event.recurrence_rule;
    if (!rule) {
      if (event.starts_on <= rangeEnd && event.ends_on >= rangeStart) expanded.push(event);
      continue;
    }
    const exceptions = new Map(
      (event.occurrence_exceptions ?? [])
        .filter((exception) => dateIsOccurrence(event, exception.occurrence_on))
        .map((exception) => [exception.occurrence_on, exception]),
    );
    const durationDays = Math.max(0, daysBetween(event.starts_on, event.ends_on));
    let candidate = addDays(rangeStart, -durationDays);
    if (compareDateOnly(candidate, event.starts_on) < 0) candidate = event.starts_on;
    while (
      compareDateOnly(candidate, rangeEnd) <= 0
      && (!rule.until || compareDateOnly(candidate, rule.until) <= 0)
    ) {
      const elapsedDays = daysBetween(event.starts_on, candidate);
      const elapsedWeeks = Math.floor(elapsedDays / 7);
      if (
        elapsedDays >= 0
        && elapsedWeeks % rule.interval === 0
        && rule.weekdays.includes(weekday(candidate))
      ) {
        const occurrenceEnd = addDays(candidate, durationDays);
        if (
          compareDateOnly(occurrenceEnd, rangeStart) >= 0
          && !exceptions.has(candidate)
        ) {
          expanded.push({
            ...event,
            starts_on: candidate,
            ends_on: occurrenceEnd,
            series_starts_on: event.starts_on,
            series_ends_on: event.ends_on,
            series_start_time: event.start_time,
            series_end_time: event.end_time,
            original_occurrence_on: candidate,
            occurrence_key: `${event.id}:${candidate}`,
          });
        }
      }
      candidate = addDays(candidate, 1);
    }
    for (const exception of exceptions.values()) {
      if (
        exception.kind !== "moved"
        || exception.starts_on === null
        || exception.ends_on === null
        || compareDateOnly(exception.starts_on, rangeEnd) > 0
        || compareDateOnly(exception.ends_on, rangeStart) < 0
      ) {
        continue;
      }
      expanded.push({
        ...event,
        starts_on: exception.starts_on,
        ends_on: exception.ends_on,
        start_time: exception.start_time,
        end_time: exception.end_time,
        series_starts_on: event.starts_on,
        series_ends_on: event.ends_on,
        series_start_time: event.start_time,
        series_end_time: event.end_time,
        original_occurrence_on: exception.occurrence_on,
        occurrence_key: `${event.id}:${exception.occurrence_on}`,
      });
    }
  }
  return expanded.sort(
    (left, right) =>
      left.starts_on.localeCompare(right.starts_on)
      || (left.start_time ?? "").localeCompare(right.start_time ?? "")
      || left.title.localeCompare(right.title),
  );
}
