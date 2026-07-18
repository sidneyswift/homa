import { DEFAULT_FAMILY_NAME } from "./digest-format";

/**
 * Formatting helpers for the founder console (MJ-14). All day grouping
 * and time labels use the founder's own time zone (HOMA_ADMIN_TZ,
 * default America/New_York): "did Saturday's sends go out" is a founder
 * question, so the console reads in founder-local days.
 */

export function adminTimeZone(): string {
  return process.env.HOMA_ADMIN_TZ ?? "America/New_York";
}

export function timeAgo(value: string | Date | null, now: Date = new Date()): string {
  if (!value) return "never";
  const then = typeof value === "string" ? new Date(value) : value;
  const minutes = Math.max(0, Math.round((now.getTime() - then.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Sortable founder-local day key, e.g. "2026-07-11". */
export function dayKey(value: string | Date, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "Saturday, July 11" in the founder's time zone. */
export function dayLabel(value: string | Date, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** "6:04 PM" in the founder's time zone. */
export function timeLabel(value: string | Date, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** families.name defaults to DEFAULT_FAMILY_NAME until the parent renames
 * it during onboarding (see the create_my_family RPC). In the founder
 * console that default means "never renamed," which for a fresh,
 * still-empty signup reads as "never finished creating a family" rather
 * than a real name. */
export function familyDisplayName(name: string): string {
  return name === DEFAULT_FAMILY_NAME ? "Family not set up" : name;
}

export function formatInt(value: number): string {
  return value.toLocaleString("en-US");
}

/** Compact token counts for the AI usage tile: 12k, 3.4M. */
export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

/** Whole-percent share, safe against a zero denominator. */
export function percent(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

/** Median without the integer rounding, for dollar amounts where cents
 * carry the meaning (median() would turn $0.42 into $0). */
export function medianExact(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** Age in whole years from a full birth date (children.birth_month holds
 * YYYY-MM-DD since the 2026-07-11 ruling). */
export function ageYears(birthDate: string, now: Date = new Date()): number {
  const born = new Date(birthDate);
  return Math.max(0, Math.floor((now.getTime() - born.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
}

/** "6:00 am" for a task's local hour (server-safe twin of the tasks
 * tab's client helper; that module is "use client" and cannot be
 * imported here). */
export function taskHourLabel(hour: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${hour < 12 ? "am" : "pm"}`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function taskWeekdaysLabel(weekdays: number[]): string {
  const set = new Set(weekdays);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) return "Weekdays";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Weekends";
  return [...set]
    .sort((a, b) => a - b)
    .map((day) => DAY_SHORT[day])
    .join(", ");
}
