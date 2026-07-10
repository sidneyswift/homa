import { getMapDomain, type MapScores, type ReportNarrative } from "@homa/core";

/**
 * The report's archive shape and its movement math (the report's own
 * "Stories so far" chapter-by-chapter view was removed round 2, founder
 * ask 2026-07-09: the snapshot chart and the whole picture already show
 * the arc). `GrowthEra` still feeds the snapshot's trajectory chart, and
 * `movementBetween` still powers the separate evidence/archive page.
 */

export interface GrowthEra {
  generated_at: string;
  scores: MapScores;
  narrative?: ReportNarrative | null;
}

const POSITION_RANK: Record<string, number> = {
  not_mapped: 0,
  growing: 1,
  on_track: 2,
  ahead: 3,
};

export function movementBetween(prev: MapScores, next: MapScores): string[] {
  const lines: string[] = [];
  for (const current of next.domains) {
    if (current.exposureBased) continue;
    const previous = prev.domains.find((entry) => entry.domainId === current.domainId);
    if (!previous) continue;
    const name = getMapDomain(current.domainId)?.displayName ?? current.domainId;
    if (
      current.monthsAhead !== null &&
      previous.monthsAhead !== null &&
      current.monthsAhead > previous.monthsAhead
    ) {
      lines.push(`${name} +${current.monthsAhead - previous.monthsAhead} mo`);
    } else if ((POSITION_RANK[current.position] ?? 0) > (POSITION_RANK[previous.position] ?? 0)) {
      lines.push(`${name} moved up`);
    }
  }
  return lines;
}

