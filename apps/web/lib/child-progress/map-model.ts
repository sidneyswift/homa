import { subjectLine } from "@homa/core";
import { buildProgressComparison, type ProgressComparison } from "./comparison";
import type { MapScores } from "@homa/core";

import type { ChildProgressView, ProgressSubjectView } from "./types";
import { formatProgressDate } from "./view-copy";

/**
 * The Progress map's tile view model: one serializable card per subject,
 * built server-side so the client grid stays a pure renderer. Badge
 * wording reuses core's reviewed subjectLine vocabulary. The dated
 * movement chip retired on founder request (2026-07-13): two number
 * pills on one tile read as two verdicts.
 */

/** After this many days without evidence a subject reads as quiet. */
const QUIET_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProgressTileBadge {
  label: string;
  background: string;
  color: string;
}

export interface ProgressTileFreshness {
  kind: "today" | "recent" | "quiet";
  label: string;
}

export interface ProgressTileModel {
  comparison?: ProgressComparison;
  subjectId: string;
  displayName: string;
  badge: ProgressTileBadge | null;
  freshness: ProgressTileFreshness | null;
  needsConfirm: boolean;
  /** True when the subject can take the deeper check (a scored,
   * age-normed subject): the detail panel's validate-the-reading door
   * (founder ask 2026-07-14). Exposure subjects and unscored subjects
   * have no deeper ladder to walk. */
  deeperCheck: boolean;
}

/** Tones per core badge string, matching kidPill's reassurance palette. */
const BADGE_TONES: Record<string, { background: string; color: string }> = {
  Ahead: { background: "var(--gold-100)", color: "var(--gold-ink)" },
  "On track": { background: "var(--sage-50)", color: "var(--sage-700)" },
  "Growing right now": {
    background: "var(--info-soft)",
    color: "var(--sky-600)",
  },
  "Part of your world": {
    background: "var(--sage-50)",
    color: "var(--sage-700)",
  },
};
const BADGE_TONE_FALLBACK = {
  background: "var(--stone-100)",
  color: "var(--stone-600)",
} as const;

function tileBadge(
  scores: MapScores,
  subjectId: string,
  childName: string,
): ProgressTileBadge | null {
  const score = scores.subjects.find(
    (entry) => entry.subjectId === subjectId,
  );
  if (!score || score.position === "not_mapped") return null;
  const line = subjectLine(score, childName);
  const tone = BADGE_TONES[line.badge] ?? BADGE_TONE_FALLBACK;
  return {
    label: line.numberLabel
      ? `${line.badge} \u00b7 ${line.numberLabel}`
      : line.badge,
    ...tone,
  };
}

function tileFreshness(
  subject: ProgressSubjectView,
  timeZone: string,
  now: Date,
): ProgressTileFreshness | null {
  if (subject.state === "updated_recently") {
    return { kind: "today", label: "Updated today" };
  }
  if (subject.latestObservedAt === null) return null;
  // One verb for one fact (editor gate): the quiet tier keeps its gold
  // dot but never switches from "Updated" to a second name.
  const date = formatProgressDate(subject.latestObservedAt, timeZone);
  const ageDays =
    (now.getTime() - new Date(subject.latestObservedAt).getTime()) / DAY_MS;
  return ageDays > QUIET_AFTER_DAYS
    ? { kind: "quiet", label: `Updated ${date}` }
    : { kind: "recent", label: `Updated ${date}` };
}

/**
 * One tile per live subject, strongest first (the chart's own order),
 * subjects outside the strength order following in projection order.
 */
export function buildProgressTiles(
  view: ChildProgressView,
  now: Date,
): ProgressTileModel[] {
  const bySubjectId = new Map(
    view.subjects.map((subject) => [subject.subjectId, subject]),
  );
  const ordered: ProgressSubjectView[] = [];
  for (const subjectId of view.scores.strengthOrder) {
    const subject = bySubjectId.get(subjectId);
    if (!subject) continue;
    ordered.push(subject);
    bySubjectId.delete(subjectId);
  }
  for (const subject of view.subjects) {
    if (bySubjectId.has(subject.subjectId)) ordered.push(subject);
  }

  return ordered.map((subject) => {
    const score = view.scores.subjects.find(
      (entry) => entry.subjectId === subject.subjectId,
    );
    return {
      comparison: buildProgressComparison(view, subject.subjectId),
      subjectId: subject.subjectId,
      displayName: subject.displayName,
      badge: tileBadge(view.scores, subject.subjectId, view.childName),
      freshness: tileFreshness(subject, view.timeZone, now),
      needsConfirm: subject.state === "conflict",
      deeperCheck: Boolean(
        score && score.position !== "not_mapped" && !score.exposureBased,
      ),
    };
  });
}

export interface ProgressUpdatedLine {
  label: string;
  /** True when something landed today (the line renders in sage). */
  today: boolean;
}

/**
 * The header's freshness line. It dates the reading, not the newest
 * ledger row: the projection is rebuilt from the ledger on every load,
 * so the page is current as of the visit even when the newest evidence
 * is older (founder ask 2026-07-21; "Updated Jul 12" on a July 21 visit
 * read as a stale page). "Updated today" still marks days evidence
 * lands; per-subject rows keep the per-evidence dates. Null before any
 * evidence exists, where the first check-in owns the page.
 */
export function progressUpdatedLine(
  view: ChildProgressView,
  now: Date,
): ProgressUpdatedLine | null {
  const hasEvidence = view.subjects.some(
    (subject) => subject.latestObservedAt !== null,
  );
  if (!hasEvidence) return null;
  const today = view.subjects.some(
    (subject) => subject.state === "updated_recently",
  );
  // "Updated today" carries the whole fact; adding the date would say
  // it twice (editor gate).
  if (today) return { label: "Updated today", today: true };
  return {
    label: `As of ${formatProgressDate(now.toISOString(), view.timeZone)}`,
    today: false,
  };
}
