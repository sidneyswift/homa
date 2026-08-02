import type { FamilyEventRecord } from "../../lib/family-events";
import { addDays, compareDateOnly, daysInRange, type DateOnly } from "./date-utils";

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
    for (const date of daysInRange(rangeStart, rangeEnd)) {
      if (compareDateOnly(date, event.starts_on) < 0) continue;
      if (rule.until && compareDateOnly(date, rule.until) > 0) continue;
      const elapsedWeeks = Math.floor(daysBetween(event.starts_on, date) / 7);
      if (elapsedWeeks % rule.interval !== 0 || !rule.weekdays.includes(weekday(date))) continue;
      expanded.push({ ...event, starts_on: date, ends_on: addDays(date, durationDays) });
    }
  }
  return expanded;
}
