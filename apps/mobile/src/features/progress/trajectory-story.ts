import { getMapSubject, type MapPosition } from "@homa/core";

import { chartMonthsForScore, displayMonths } from "./trajectory-format";
import type { TrajectoryEra } from "./trajectory-eras";

/**
 * The trajectory chart's story layer, ported verbatim from
 * apps/web/lib/map/trajectory-story.ts (keep in sync): turns
 * re-normalized eras into plot-ready series, the week's movers, and the
 * snapshot's caption. Pure functions, no I/O, so the caption and the
 * chart can never disagree about what moved. The anti-guilt law from
 * the web twin carries over unchanged: only net INCREASES are movers; a
 * drop plots honestly on the line but is never headlined.
 */

export interface TrajectoryStoryPoint {
  t: number;
  months: number;
  /** Measuring-stick fingerprint; a change between adjacent points
   * draws their connecting segment dotted. */
  basisKey: string;
}

export interface TrajectoryStorySubject {
  subjectId: string;
  name: string;
  points: TrajectoryStoryPoint[];
  /** The latest plotted value (negative below age). */
  latestMonths: number;
  /** "+10", "15+" (capped floor), or "-10". */
  display: string;
  beyondScale: boolean;
  position: MapPosition;
  observations: number;
  strongestStatement: string | null;
  strongestMonths: number | null;
  frontierStatement: string | null;
  /** Net change registered this week, null when the line held. */
  mover: { from: number; to: number } | null;
}

export interface TrajectoryStory {
  /** Strongest first (the latest era's strengthOrder). */
  subjects: TrajectoryStorySubject[];
  movers: TrajectoryStorySubject[];
  belowAge: TrajectoryStorySubject[];
  caption: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
] as const;

function countWord(n: number): string {
  return n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
}

/** Mid-sentence form of a subject name. */
function midSentence(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function buildTrajectoryStory(
  eras: readonly TrajectoryEra[],
): TrajectoryStory {
  if (eras.length === 0) {
    return { subjects: [], movers: [], belowAge: [], caption: "" };
  }
  const latest = eras[eras.length - 1];
  // "This week" is the seven days ending at the newest scoring, so the
  // caption describes the data's week, not whenever the page is opened.
  const latestT = Math.max(
    ...eras
      .map((era) => Date.parse(era.generated_at))
      .filter((t) => Number.isFinite(t)),
  );
  const windowStart = latestT - WEEK_MS;

  const subjects: TrajectoryStorySubject[] = [];
  for (const subjectId of latest.scores.strengthOrder) {
    const latestScore = latest.scores.subjects.find(
      (entry) => entry.subjectId === subjectId,
    );
    if (!latestScore || latestScore.exposureBased) continue;

    const points: TrajectoryStoryPoint[] = [];
    for (const era of eras) {
      const score = era.scores.subjects.find(
        (entry) => entry.subjectId === subjectId,
      );
      if (!score || score.exposureBased || score.position === "not_mapped") {
        continue;
      }
      const months = chartMonthsForScore(score);
      if (months === null) continue;
      const t = Date.parse(era.generated_at);
      if (!Number.isFinite(t)) continue;
      points.push({ t, months, basisKey: era.basisKey });
    }
    points.sort((a, b) => a.t - b.t);
    if (points.length === 0) continue;

    // The week's net move: only net increases are movers (anti-guilt
    // law). A subject whose first-ever point landed this week is a
    // debut, not a mover.
    let mover: { from: number; to: number } | null = null;
    for (let index = 1; index < points.length; index += 1) {
      if (
        points[index].t >= windowStart &&
        points[index].months !== points[index - 1].months
      ) {
        const from = points[index - 1].months;
        const to = points[points.length - 1].months;
        if (to > from) mover = { from, to };
        break;
      }
    }

    const latestMonths = points[points.length - 1].months;
    subjects.push({
      subjectId,
      name: getMapSubject(subjectId)?.displayName ?? subjectId,
      points,
      latestMonths,
      display: displayMonths(latestMonths, latestScore.beyondScale),
      beyondScale: latestScore.beyondScale,
      position: latestScore.position,
      observations: latestScore.observations,
      strongestStatement: latestScore.strongestObservedStatement,
      strongestMonths: latestScore.strongestObservedMonths ?? null,
      frontierStatement: latestScore.frontierStatement,
      mover,
    });
  }

  const movers = subjects.filter((subject) => subject.mover !== null);
  const belowAge = subjects.filter((subject) => subject.latestMonths < 0);
  const debutOnly = subjects.every(
    (subject) => subject.points[0].t >= windowStart,
  );

  return {
    subjects,
    movers,
    belowAge,
    caption: buildCaption({ subjects, movers, belowAge, debutOnly }),
  };
}

function buildCaption(input: {
  subjects: TrajectoryStorySubject[];
  movers: TrajectoryStorySubject[];
  belowAge: TrajectoryStorySubject[];
  debutOnly: boolean;
}): string {
  const { subjects, movers, belowAge, debutOnly } = input;
  if (subjects.length === 0) return "";

  const belowClause = belowAge.length
    ? belowAge
        .map(
          (subject) => `${midSentence(subject.name)} reads ${subject.display}`,
        )
        .join(" and ")
    : null;

  // First week: everything just appeared, so there is no movement story
  // yet, only the map itself.
  if (debutOnly) {
    const first = `One line per subject, from this week's first check-ins.`;
    return belowClause ? `${first} ${capitalize(belowClause)}.` : first;
  }

  if (movers.length === 0) {
    return belowClause
      ? `Everything held steady this week; ${belowClause}.`
      : "Everything held steady this week.";
  }

  const moverNames = movers.map((subject, index) =>
    index === 0 ? subject.name : midSentence(subject.name),
  );
  const climbed =
    movers.length === 1
      ? `${moverNames[0]} climbed from ${displayMonths(movers[0].mover?.from ?? 0, false)} to ${movers[0].display} this week.`
      : `${joinNames(moverNames)} climbed this week.`;

  const steadyCount =
    subjects.length -
    movers.length -
    belowAge.filter((s) => !s.mover).length;
  const steady =
    steadyCount > 0
      ? `${countWord(steadyCount)} ${steadyCount === 1 ? "subject" : "subjects"} held steady`
      : null;

  if (steady && belowClause) {
    return `${climbed} ${capitalize(steady)}; ${belowClause}.`;
  }
  if (steady) return `${climbed} ${capitalize(steady)}.`;
  if (belowClause) return `${climbed} ${capitalize(belowClause)}.`;
  return climbed;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
