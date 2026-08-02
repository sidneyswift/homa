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
        if (compareDateOnly(occurrenceEnd, rangeStart) >= 0) {
          expanded.push({
            ...event,
            starts_on: candidate,
            ends_on: occurrenceEnd,
            series_starts_on: event.starts_on,
            series_ends_on: event.ends_on,
            occurrence_key: `${event.id}:${candidate}`,
          });
        }
      }
      candidate = addDays(candidate, 1);
    }
  }
  return expanded.sort(
    (left, right) =>
      left.starts_on.localeCompare(right.starts_on)
      || (left.start_time ?? "").localeCompare(right.start_time ?? "")
      || left.title.localeCompare(right.title),
  );
}
