import { subjectLine } from "@homa/core";
import type { MapScores } from "@homa/core";

import { palette } from "../../theme/tokens";
import type { ChildProgressView, ProgressSubjectView } from "./types";
import { formatProgressDate } from "./view-copy";

/**
 * The Progress tile view model, ported from
 * apps/web/lib/child-progress/map-model.ts: one serializable card per
 * subject so the grid stays a pure renderer. Badge wording reuses
 * core's reviewed subjectLine vocabulary; only the tone values changed
 * from CSS variables to the hand-copied token palette (nearest existing
 * token, never an invented color).
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
  freshness: ProgressTileFreshness | null;
  needsConfirm: boolean;
  /** True when the subject can take the deeper check (a scored,
   * age-normed subject). Exposure and unscored subjects have no deeper
   * ladder to walk (web twin, founder ask 2026-07-14). */
  deeperCheck: boolean;
}

/** Tones per core badge string, the web reassurance palette mapped onto
 * the mobile token sheet (sage-700 and sky-600 have no mobile copies
 * yet, so their nearest tokens stand in: sage600 and sky500). */
const BADGE_TONES: Record<string, { background: string; color: string }> = {
  Ahead: { background: palette.gold100, color: palette.goldInk },
  "On track": { background: palette.sage50, color: palette.sage600 },
  "Growing right now": { background: palette.sky100, color: palette.sky500 },
  "Part of your world": { background: palette.sage50, color: palette.sage600 },
};
const BADGE_TONE_FALLBACK = {
  background: palette.stone100,
  color: palette.stone600,
} as const;

/** Freshness dot tones (web TILE_DOT_TONES; gold-400 stands in as
 * gold500, the only gold line tone the mobile sheet carries). */
export const TILE_DOT_TONES: Record<
  NonNullable<ProgressTileModel["freshness"]>["kind"],
  string
> = {
  today: palette.sage500,
  recent: palette.stone300,
  quiet: palette.gold500,
};

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
      ? `${line.badge} · ${line.numberLabel}`
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
  // One verb for one fact (web editor gate): the quiet tier keeps its
  // gold dot but never switches from "Updated" to a second name.
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
 * The header's freshness line: "Updated today" when anything landed
 * today, otherwise the newest observation's date. Null before any
 * evidence exists (web twin).
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
  return {
    label: today ? "Updated today" : `Updated ${date}`,
    today,
  };
}
