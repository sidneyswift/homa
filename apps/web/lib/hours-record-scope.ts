import { z } from "zod";

import { isValidDateOnly } from "./compliance/deadlines";

/** Explicit record scope, shared by previews, downloads and child totals. */
export interface HoursRecordScope {
  childId: string | null;
  from: string | null;
  through: string | null;
  includeShared: boolean;
}

export const ALL_HOURS_RECORDS: HoursRecordScope = {
  childId: null, from: null, through: null, includeShared: true,
};

export type HoursRecordFormat = "entries" | "days" | "preview";

export function parseHoursRecordRequest(params: URLSearchParams): {
  scope: HoursRecordScope; format: HoursRecordFormat; revision: string | null;
} | null {
  const allowed = new Set(["child", "from", "through", "shared", "format", "revision"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) return null;
  }
  const childId = params.get("child")?.toLowerCase() || null;
  const from = params.get("from") || null;
  const through = params.get("through") || null;
  const shared = params.get("shared") ?? "include";
  const format = params.get("format") ?? "entries";
  const revision = params.get("revision");
  if (childId !== null && !z.uuid().safeParse(childId).success) return null;
  if ((from !== null && !isValidDateOnly(from)) || (through !== null && !isValidDateOnly(through))) return null;
  if (from !== null && through !== null && from > through) return null;
  if (shared !== "include" && shared !== "exclude") return null;
  if (format !== "entries" && format !== "days" && format !== "preview") return null;
  if (revision !== null && !/^[a-f0-9]{64}$/.test(revision)) return null;
  return { scope: { childId, from, through, includeShared: shared === "include" }, format, revision };
}

export function hoursRecordParams(scope: HoursRecordScope): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.childId !== null) params.set("child", scope.childId);
  if (scope.from !== null) params.set("from", scope.from);
  if (scope.through !== null) params.set("through", scope.through);
  params.set("shared", scope.includeShared ? "include" : "exclude");
  return params;
}

export function matchesHoursRecordScope(
  row: { childId: string | null; happenedOn: string },
  scope: HoursRecordScope,
): boolean {
  return (scope.from === null || row.happenedOn >= scope.from)
    && (scope.through === null || row.happenedOn <= scope.through)
    && (row.childId !== null || scope.includeShared)
    && (scope.childId === null || row.childId === scope.childId || (row.childId === null && scope.includeShared));
}

export interface HoursRecordChild { id: string; name: string }

/** Names remain labels. Only collisions get a stable, locally unique record
 * suffix so the parent can distinguish the same records across artifacts. */
export function hoursRecordChildLabel(child: HoursRecordChild, children: readonly HoursRecordChild[]): string {
  const sameName = children.filter((other) => other.name.trim().toLocaleLowerCase("en-US") === child.name.trim().toLocaleLowerCase("en-US"));
  if (sameName.length < 2) return child.name;
  let length = 6;
  while (length < child.id.length && sameName.some((other) => other.id !== child.id && other.id.slice(-length) === child.id.slice(-length))) length++;
  return `${child.name} (record ${child.id.slice(-length)})`;
}

export interface RecordedLearningDay {
  childId: string | null;
  childName: string;
  happenedOn: string;
  subjects: string[];
  minutes: number;
}

/** A timed record establishes a recorded day, never presence or absence. */
export function deriveRecordedLearningDays(
  entries: readonly { childId: string | null; happenedOn: string; minutes: number; subject: string }[],
  children: readonly HoursRecordChild[],
  scope: HoursRecordScope = ALL_HOURS_RECORDS,
): RecordedLearningDay[] {
  const byId = new Map(children.map((child) => [child.id, child]));
  if (byId.size !== children.length) throw new Error("Duplicate child identity in Hours roster.");
  if (scope.childId !== null && !byId.has(scope.childId)) throw new Error("Hours child is not in the family roster.");
  const selected = scope.childId === null ? children : children.filter((child) => child.id === scope.childId);
  const days = new Map<string, RecordedLearningDay>();
  for (const entry of entries) {
    if (!matchesHoursRecordScope(entry, scope)) continue;
    if (!isValidDateOnly(entry.happenedOn) || !Number.isSafeInteger(entry.minutes) || entry.minutes < 1) {
      throw new Error("Invalid saved Hours record.");
    }
    if (entry.childId !== null && !byId.has(entry.childId)) throw new Error("Hours record has no owned child.");
    const recipients: readonly { id: string | null; name: string }[] = entry.childId === null
      ? selected.length > 0 ? selected : [{ id: null, name: "Whole family" }]
      : [byId.get(entry.childId)!];
    for (const child of recipients) {
      const key = `${child.id ?? "family"}\u0000${entry.happenedOn}`;
      const current = days.get(key);
      if (current) {
        current.minutes += entry.minutes;
        if (!current.subjects.includes(entry.subject)) current.subjects.push(entry.subject);
      } else {
        days.set(key, { childId: child.id, childName: child.name, happenedOn: entry.happenedOn, subjects: [entry.subject], minutes: entry.minutes });
      }
    }
  }
  return [...days.values()].sort((left, right) => left.happenedOn.localeCompare(right.happenedOn)
    || left.childName.localeCompare(right.childName) || (left.childId ?? "").localeCompare(right.childId ?? ""));
}

export function summarizeRecordedLearningDays(
  days: readonly RecordedLearningDay[],
  children: readonly HoursRecordChild[],
  scope: HoursRecordScope = ALL_HOURS_RECORDS,
) {
  const selected = children.filter((child) => scope.childId === null || child.id === scope.childId);
  const recipients: readonly { id: string | null; name: string }[] = selected.length > 0
    ? selected : scope.childId === null ? [{ id: null, name: "Whole family" }] : [];
  return recipients.map((child) => {
    const rows = days.filter((day) => day.childId === child.id);
    return { childId: child.id, childName: child.name, recordedDays: rows.length, minutes: rows.reduce((sum, day) => sum + day.minutes, 0) };
  });
}
