import type { TaskRun } from "../../lib/tasks";

/**
 * Pure formatting for the tasks screen, ported from the web twins:
 * hourLabel/weekdaysLabel/nextRunLabel (app/app/tasks/tasks-view.tsx),
 * groupRunsByDay/statusNote/timeLabel (app/app/tasks/task-history.tsx),
 * and effectiveTimeZone (lib/time-zone.ts). Keep the words identical;
 * both surfaces should describe the same run the same way.
 */

/** Central time is the fallback middle of a US-only audience, same as
 * the web's FALLBACK_TIME_ZONE, for families whose zone is not captured
 * yet. */
const FALLBACK_TIME_ZONE = "America/Chicago";

export function effectiveTimeZone(stored: string | null | undefined): string {
  return stored || FALLBACK_TIME_ZONE;
}

export function hourLabel(hour: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${hour < 12 ? "am" : "pm"}`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdaysLabel(weekdays: number[]): string {
  const set = new Set(weekdays);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return [...set]
    .sort((a, b) => a - b)
    .map((day) => DAY_SHORT[day])
    .join(", ");
}

/** Hermes ships Intl with zone data on Expo SDK 56, but a family row
 * could still hold a zone string this device's ICU tables lack; a wrong
 * zone must degrade to device-local words, never crash the screen. */
function safeLocaleString(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone: string,
): string {
  try {
    return date.toLocaleString("en-US", { ...options, timeZone });
  } catch {
    return date.toLocaleString("en-US", options);
  }
}

export function nextRunLabel(iso: string, timeZone: string): string {
  return safeLocaleString(
    new Date(iso),
    { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
    timeZone,
  );
}

export function timeLabel(iso: string, timeZone: string): string {
  return safeLocaleString(
    new Date(iso),
    { hour: "numeric", minute: "2-digit" },
    timeZone,
  );
}

export function deliveryLabel(pref: "text" | "email" | "none"): string {
  return pref === "text"
    ? "by text"
    : pref === "email"
      ? "by email"
      : "saved to this page";
}

/** The done lines pair delivery truth with the Ask Homa door. Uncertain
 * and failed rows stay factual and calm: no red, no alarm (design law). */
export function statusNote(run: TaskRun): string | null {
  switch (run.status) {
    case "done":
      return run.deliveredChannel === "sms"
        ? "Sent by text."
        : run.deliveredChannel === "email"
          ? "Sent by email."
          : run.deliveredChannel === "none"
            ? "Saved to this page."
            : null;
    case "skipped":
      return "Skipped: this task's scheduled time had passed. It is scheduled again at its next time.";
    case "partial":
      // No counts: the string can't know how many deliveries failed
      // (web editor gate 2026-07-13, no invented numbers).
      return "It reached at least one family member. It is available on this page.";
    case "partial_uncertain":
      return "It reached at least one family member. Homa can't tell yet whether other deliveries arrived. It is available on this page.";
    case "uncertain":
      return "Homa couldn't confirm delivery. Nothing else needs your attention right now.";
    case "failed":
      return "This task did not send.";
    case "running":
      return "Homa is preparing this task now.";
    default: {
      const exhaustive: never = run.status;
      throw new Error(`unhandled run status: ${String(exhaustive)}`);
    }
  }
}

function dayKey(date: Date, timeZone: string): string {
  try {
    return date.toLocaleDateString("en-CA", { timeZone });
  } catch {
    return date.toLocaleDateString("en-CA");
  }
}

export interface TaskRunDayGroup {
  key: string;
  label: string;
  runs: TaskRun[];
}

/**
 * One group per family-local day, newest day first (the input is already
 * newest-run-first). Labels stay plain: Today, Yesterday, then the
 * dated weekday. Same shape as the web's groupRunsByDay.
 */
export function groupRunsByDay(
  runs: TaskRun[],
  timeZone: string,
  now: Date = new Date(),
): TaskRunDayGroup[] {
  const todayKey = dayKey(now, timeZone);
  const yesterdayKey = dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000), timeZone);

  const groups: TaskRunDayGroup[] = [];
  for (const run of runs) {
    const started = new Date(run.startedAt);
    const key = dayKey(started, timeZone);
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.runs.push(run);
      continue;
    }
    groups.push({
      key,
      label:
        key === todayKey
          ? "Today"
          : key === yesterdayKey
            ? "Yesterday"
            : safeLocaleString(
                started,
                { weekday: "short", month: "short", day: "numeric" },
                timeZone,
              ),
      runs: [run],
    });
  }
  return groups;
}
