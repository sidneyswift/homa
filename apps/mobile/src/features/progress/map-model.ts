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
  if (subject.state === "updated_recently") {
    return { kind: "today", label: "Updated today", dotColor: colors.sage };
  }
  if (subject.latestObservedAt === null) return null;
  const date = formatProgressDate(subject.latestObservedAt, timeZone);
  const ageDays = (now.getTime() - new Date(subject.latestObservedAt).getTime()) / DAY_MS;
  return ageDays > QUIET_AFTER_DAYS
    ? { kind: "quiet", label: `Updated ${date}`, dotColor: colors.gold }
    : { kind: "recent", label: `Updated ${date}`, dotColor: palette.stone300 };
}

export interface ProgressUpdatedLine {
  label: string;
  today: boolean;
}

export function progressUpdatedLine(view: ChildProgressView, now: Date): ProgressUpdatedLine | null {
  const hasEvidence = view.subjects.some((subject) => subject.latestObservedAt !== null);
  if (!hasEvidence) return null;
  const today = view.subjects.some((subject) => subject.state === "updated_recently");
  if (today) return { label: "Updated today", today: true };
  return { label: `As of ${formatProgressDate(now.toISOString(), view.timeZone)}`, today: false };
}
