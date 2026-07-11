import type { SubjectScore, MapScores } from "@homa/core";

/**
 * Movement between scorings, the dashboard surfaces' shared copy of the
 * report's rule: months gained or a position climbed counts, drops render
 * NOTHING (anti-guilt law; a slowdown becomes a quiet re-check note, never
 * a down-arrow). Same semantics as report-view.tsx's movementFor.
 */

const POSITION_RANK: Record<SubjectScore["position"], number> = {
  not_mapped: 0,
  growing: 1,
  on_track: 2,
  ahead: 3,
};

export interface Movement {
  /** "+4 mo since Jun 6" (gold) or "moved up since Jun 6" (sage). */
  label: string;
  tone: "gold" | "sage";
}

export function movementFor(
  current: SubjectScore,
  prior: { scores: MapScores; generated_at: string } | undefined,
): Movement | null {
  if (!prior || current.exposureBased) return null;
  const previous = prior.scores.subjects.find((entry) => entry.subjectId === current.subjectId);
  if (!previous) return null;
  const since = new Date(prior.generated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (
    current.monthsAhead !== null &&
    previous.monthsAhead !== null &&
    current.monthsAhead > previous.monthsAhead
  ) {
    return { label: `+${current.monthsAhead - previous.monthsAhead} mo since ${since}`, tone: "gold" };
  }
  if (POSITION_RANK[current.position] > POSITION_RANK[previous.position]) {
    return { label: `moved up since ${since}`, tone: "sage" };
  }
  return null;
}

/** How many subjects genuinely moved up since the prior scoring. */
export function movedUpCount(scores: MapScores, prior: MapScores | undefined): number {
  if (!prior) return 0;
  const priorById = new Map(prior.subjects.map((score) => [score.subjectId, score]));
  return scores.subjects.filter((score) => {
    const previous = priorById.get(score.subjectId);
    if (!previous || score.exposureBased) return false;
    const monthsImproved =
      score.monthsAhead !== null &&
      previous.monthsAhead !== null &&
      score.monthsAhead > previous.monthsAhead;
    return monthsImproved || POSITION_RANK[score.position] > POSITION_RANK[previous.position];
  }).length;
}
