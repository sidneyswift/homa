import type { FamilyEventRow } from "./family-events";

/** Authoritative audience with an expand-contract fallback for rows created
 * before family_event_children existed. child_id stays a compatibility marker
 * and must be present in a consistent multi-child link set. */
export function familyEventChildIds(
  event: Pick<FamilyEventRow, "childId" | "childIds">,
): string[] {
  if (event.childId === null) return [];
  const linked = event.childIds ?? [];
  return linked.includes(event.childId) ? [...new Set(linked)] : [event.childId];
}

/** Date-only day arithmetic in UTC, so a YYYY-MM-DD can never shift a
 * day through a local-timezone parse. */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekdayForDateOnly(dateOnly: string): number {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function daysBetweenDateOnly(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / (24 * 60 * 60 * 1000),
  );
}

/** Expands stored weekly series only inside the requested Planner window.
 * The original row remains canonical; occurrence dates are view data. */
export function expandRecurringFamilyEvents(
  events: readonly FamilyEventRow[],
  rangeStart: string,
  rangeEnd: string,
): FamilyEventRow[] {
  const expanded: FamilyEventRow[] = [];
  for (const event of events) {
    const rule = event.recurrence;
    if (!rule) {
      if (event.startsOn <= rangeEnd && event.endsOn >= rangeStart) {
        expanded.push({ ...event, occurrenceKey: `${event.id}:${event.startsOn}` });
      }
      continue;
    }

    const durationDays = Math.max(0, daysBetweenDateOnly(event.startsOn, event.endsOn));
    let candidate = addDaysToDateOnly(rangeStart, -durationDays);
    if (candidate < event.startsOn) candidate = event.startsOn;
    while (candidate <= rangeEnd && (rule.until === null || candidate <= rule.until)) {
      const elapsedDays = daysBetweenDateOnly(event.startsOn, candidate);
      const elapsedWeeks = Math.floor(elapsedDays / 7);
      if (
        elapsedDays >= 0
        && elapsedWeeks % rule.interval === 0
        && rule.weekdays.includes(weekdayForDateOnly(candidate))
      ) {
        const occurrenceEnd = addDaysToDateOnly(candidate, durationDays);
        if (occurrenceEnd >= rangeStart) {
          expanded.push({
            ...event,
            startsOn: candidate,
            endsOn: occurrenceEnd,
            seriesStartsOn: event.startsOn,
            seriesEndsOn: event.endsOn,
            occurrenceKey: `${event.id}:${candidate}`,
          });
        }
      }
      candidate = addDaysToDateOnly(candidate, 1);
    }
  }
  return expanded.sort(
    (left, right) =>
      left.startsOn.localeCompare(right.startsOn)
      || (left.startTime ?? "").localeCompare(right.startTime ?? "")
      || left.title.localeCompare(right.title),
  );
}
