import { subjectLine, type MapScores } from "@homa/core";

import type { ChildProgressView, ProgressSubjectView } from "../../lib/child-progress";
import { colors, palette } from "../../theme/tokens";
import { formatProgressDate } from "./view-copy";

/**
 * Score badge and freshness dot, ported from
 * apps/web/lib/child-progress/map-model.ts's tileBadge/tileFreshness/
 * progressUpdatedLine. subjectLine comes straight from @homa/core
 * (already a mobile dependency), so the badge wording matches web
 * exactly; only the color tokens are mobile's own.
 */

const QUIET_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SubjectBadge {
  label: string;
  background: string;
  color: string;
}

export interface SubjectFreshness {
  kind: "today" | "recent" | "quiet";
  label: string;
  dotColor: string;
}

const BADGE_TONES: Record<string, { background: string; color: string }> = {
  Ahead: { background: colors.goldSoft, color: palette.goldInk },
  "On track": { background: colors.sageSoft, color: palette.sage600 },
  "Growing right now": { background: palette.sky100, color: palette.sky500 },
  "Part of your world": { background: colors.sageSoft, color: palette.sage600 },
};
const BADGE_TONE_FALLBACK = { background: colors.surfaceSunken, color: colors.textMuted };

export function subjectBadge(
  scores: MapScores,
  subjectId: string,
  childName: string,
): SubjectBadge | null {
  const score = scores.subjects.find((entry) => entry.subjectId === subjectId);
  if (!score || score.position === "not_mapped") return null;
  const line = subjectLine(score, childName);
  const tone = BADGE_TONES[line.badge] ?? BADGE_TONE_FALLBACK;
  return {
    label: line.numberLabel ? `${line.badge} · ${line.numberLabel}` : line.badge,
    ...tone,
  };
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
