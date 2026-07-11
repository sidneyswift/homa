import { zonedDateParts } from "../time-zone";

/**
 * Family-local schedule math for the task framework. The DST-safe
 * next-local-hour walk moved here from lib/schedule-store.ts (GW-4)
 * unchanged; the weekday mask on top is what lets the morning brief say
 * "weekday mornings only" without a second scheduling mechanism.
 */

/** The UTC instant of the next `hour`:00 wall-clock in `zone`, strictly
 * after `after`. Two-pass offset correction handles DST edges. */
export function nextLocalHourInstant(zone: string, hour: number, after: Date): Date {
  const wallClock = (instant: Date): { key: string; ms: number } => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(instant);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
    const key = `${get("year")}-${get("month")}-${get("day")}`;
    const ms = Date.UTC(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
      Number(get("hour")) % 24,
      Number(get("minute")),
    );
    return { key, ms };
  };

  // Start from "today at `hour` local" as a UTC guess and correct by the
  // observed wall-clock difference; repeat once for DST boundaries.
  const today = wallClock(after);
  let candidate = new Date(
    Date.UTC(
      Number(today.key.slice(0, 4)),
      Number(today.key.slice(5, 7)) - 1,
      Number(today.key.slice(8, 10)),
      hour,
    ),
  );
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = wallClock(candidate);
    const want = Date.UTC(
      Number(seen.key.slice(0, 4)),
      Number(seen.key.slice(5, 7)) - 1,
      Number(seen.key.slice(8, 10)),
      hour,
    );
    candidate = new Date(candidate.getTime() + (want - seen.ms));
  }
  while (candidate.getTime() <= after.getTime()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    for (let pass = 0; pass < 2; pass += 1) {
      const seen = wallClock(candidate);
      const want = Date.UTC(
        Number(seen.key.slice(0, 4)),
        Number(seen.key.slice(5, 7)) - 1,
        Number(seen.key.slice(8, 10)),
        hour,
      );
      candidate = new Date(candidate.getTime() + (want - seen.ms));
    }
  }
  return candidate;
}

/** The next `hour`:00 in `zone` strictly after `after` that lands on one
 * of `weekdays` (0 = Sunday .. 6 = Saturday). */
export function nextTaskRunInstant(
  zone: string,
  hour: number,
  weekdays: readonly number[],
  after: Date,
): Date {
  const allowed = new Set(weekdays.length > 0 ? weekdays : [0, 1, 2, 3, 4, 5, 6]);
  let candidate = nextLocalHourInstant(zone, hour, after);
  // At most 7 hops: some weekday is always allowed (store guarantees a
  // non-empty mask; the empty-mask fallback above is belt and braces).
  for (let hop = 0; hop < 8; hop += 1) {
    if (allowed.has(zonedDateParts(candidate, zone).weekday)) return candidate;
    candidate = nextLocalHourInstant(zone, hour, candidate);
  }
  return candidate;
}

/** The family-local calendar day of `instant`, as YYYY-MM-DD. The outbox
 * key: one run per schedule per local day. */
export function localDateKey(zone: string, instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The wall-clock hour (0-23) of `instant` in `zone`, for send windows. */
export function localHourOf(zone: string, instant: Date): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    hour12: false,
  }).format(instant);
  return Number(value) % 24;
}
