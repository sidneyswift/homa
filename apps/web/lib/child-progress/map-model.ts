import { subjectLine } from "@homa/core";
import type { MapScores } from "@homa/core";

import {
  movementFor,
  type Movement,
} from "../../components/dashboard/movement";
import type { ChildProgressView, ProgressSubjectView } from "./types";
import { formatProgressDate } from "./view-copy";

/**
 * The Progress map's tile view model: one serializable card per subject,
 * built server-side so the client grid stays a pure renderer. Badge
 * wording reuses core's reviewed subjectLine vocabulary; movement reuses
 * the dashboard's anti-guilt movement rule (drops render nothing).
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
  subjectId: string;
  displayName: string;
  badge: ProgressTileBadge | null;
  movement: Movement | null;
  freshness: ProgressTileFreshness | null;
  needsConfirm: boolean;
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
  prior: { scores: MapScores; generated_at: string } | undefined,
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
      subjectId: subject.subjectId,
      displayName: subject.displayName,
      badge: tileBadge(view.scores, subject.subjectId, view.childName),
      movement: score ? movementFor(score, prior) : null,
      freshness: tileFreshness(subject, view.timeZone, now),
      needsConfirm: subject.state === "conflict",
    };
  });
}

export interface ProgressUpdatedLine {
  label: string;
  /** True when something landed today (the line renders in sage). */
  today: boolean;
}

/**
 * The header's freshness line: "Updated today · Jul 12, 2026" when
 * anything landed today, otherwise the newest observation's date. Null
 * before any evidence exists.
 */
export function progressUpdatedLine(
  view: ChildProgressView,
): ProgressUpdatedLine | null {
  let latest: string | null = null;
  for (const subject of view.subjects) {
    if (subject.latestObservedAt === null) continue;
    if (
      latest === null ||
      new Date(subject.latestObservedAt).getTime() >
        new Date(latest).getTime()
    ) {
      latest = subject.latestObservedAt;
    }
  }
  if (latest === null) return null;
  const date = formatProgressDate(latest, view.timeZone);
  const today = view.subjects.some(
    (subject) => subject.state === "updated_recently",
  );
  // "Updated today" carries the whole fact; adding the date would say
  // it twice (editor gate).
  return {
    label: today ? "Updated today" : `Updated ${date}`,
    today,
  };
}
