import type { ChildProgressView, ProgressSubjectView } from "../../lib/child-progress";
import { colors, palette } from "../../theme/tokens";
import { formatProgressDate } from "./view-copy";

/**
 * Evidence freshness for the native Progress surface, ported from
 * apps/web/lib/child-progress/map-model.ts's tileFreshness and
 * progressUpdatedLine. Native deliberately does not turn the internal
 * deterministic score into a collapsed-card verdict. The newest dated
 * evidence and its source are the parent-facing summary instead.
 */

const QUIET_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function familyDateKey(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export interface SubjectFreshness {
  kind: "today" | "recent" | "quiet";
  label: string;
  dotColor: string;
}

export function subjectFreshness(
  subject: ProgressSubjectView,
  timeZone: string,
  now: Date,
): SubjectFreshness | null {
  if (subject.latestObservedAt === null) return null;
  const date = formatProgressDate(subject.latestObservedAt, timeZone);
  const observedAt = new Date(subject.latestObservedAt);
  const label = `Latest answer shared ${date}`;
  if (familyDateKey(observedAt, timeZone) === familyDateKey(now, timeZone)) {
    return { kind: "today", label, dotColor: colors.sage };
  }
  const ageDays = (now.getTime() - observedAt.getTime()) / DAY_MS;
  return ageDays > QUIET_AFTER_DAYS
    ? { kind: "quiet", label, dotColor: colors.gold }
    : { kind: "recent", label, dotColor: palette.stone300 };
}

export interface ProgressUpdatedLine {
  label: string;
  today: boolean;
}

export function latestProgressObservedAt(
  view: ChildProgressView,
): string | null {
  return view.subjects.reduce<string | null>((latest, subject) => {
    if (subject.latestObservedAt === null) return latest;
    if (latest === null) return subject.latestObservedAt;
    return new Date(subject.latestObservedAt).getTime() > new Date(latest).getTime()
      ? subject.latestObservedAt
      : latest;
  }, null);
}

export function progressUpdatedLine(view: ChildProgressView, now: Date): ProgressUpdatedLine | null {
  const latest = latestProgressObservedAt(view);
  if (latest === null) return null;
  return {
    label: `Latest answer shared ${formatProgressDate(latest, view.timeZone)}`,
    today:
      familyDateKey(new Date(latest), view.timeZone) ===
      familyDateKey(now, view.timeZone),
  };
}
