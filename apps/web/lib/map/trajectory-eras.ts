import {
  ageInMonths,
  MAP_BANK_VERSION,
  MAP_SCORER_VERSION,
  scoreMap,
  type MapAnswer,
  type MapAnswerInput,
  type MapScores,
} from "@homa/core";

/**
 * Re-normalized eras for the trajectory chart (the mixed-scales fix,
 * plans/2026-07-12-trajectory-chart-mixed-scales-investigation.md).
 *
 * An archived scoring froze its numbers under that day's measuring
 * stick: bank content, scorer rules, and the recorded birthday. All
 * three changed between July 8 and 12 and the chart drew the mixture as
 * one line, so roughly 80% of its jaggedness was tracking artifacts.
 * The durable fix (fix 3): at render time, rescore each archived era's
 * answer set, reconstructed from the append-only evidence ledger as of
 * that era's timestamp, under the CURRENT bank + scorer + birthday, so
 * the line shows only child movement.
 *
 * Eras the ledger cannot reconstruct (generated before the child's
 * earliest surviving evidence, or answers wholesale re-entered later)
 * keep their stored numbers and carry their stored measurement basis;
 * the chart then draws an honest scale boundary (fix 2) wherever
 * adjacent eras were measured differently. The live era always keeps
 * its stored scores: they are canonical and freshly computed.
 *
 * Pure functions, no I/O: callers fetch the evidence rows and stored
 * scorings, this module only computes.
 */

/** One stored scoring as archived in child_reports.history (or any
 * shape carrying the same keys). Basis stamps exist on entries written
 * after migration #78; older entries read as "basis unknown". */
export interface ArchivedScoring {
  generated_at: string;
  scores: MapScores;
  bank_version?: string | null;
  scorer_version?: string | null;
  birth_date?: string | null;
}

/** The slice of a child_progress_evidence row the reconstruction needs. */
export interface TrajectoryEvidenceRow {
  itemId: string;
  answer: Extract<MapAnswer, "easily" | "getting_there" | "not_yet">;
  observedAt: string;
  supersededAt: string | null;
  createdAt: string;
}

export interface TrajectoryEra {
  generated_at: string;
  scores: MapScores;
  /** True when scores were recomputed under the current basis. */
  renormalized: boolean;
  /** Fingerprint of the measuring stick behind these scores. Adjacent
   * eras with different keys were measured differently, and the chart
   * draws that boundary instead of pretending the line is one
   * measurement. */
  basisKey: string;
}

const UNKNOWN_BASIS_PART = "unknown";

/** The fingerprint of today's measuring stick for this child. */
export function currentBasisKey(birthDate: string): string {
  return [MAP_BANK_VERSION, MAP_SCORER_VERSION, birthDate].join("|");
}

/** A stored era's fingerprint. Missing stamps read as unknown, which
 * never equals the current basis: an archive that cannot prove it was
 * measured the same way gets the honest boundary, not silent
 * continuity. */
function storedBasisKey(era: ArchivedScoring): string {
  return [
    era.bank_version ?? UNKNOWN_BASIS_PART,
    era.scorer_version ?? UNKNOWN_BASIS_PART,
    era.birth_date ?? UNKNOWN_BASIS_PART,
  ].join("|");
}

function laterEvidence(
  candidate: { observedMs: number; row: TrajectoryEvidenceRow },
  incumbent: { observedMs: number; row: TrajectoryEvidenceRow },
): boolean {
  if (candidate.observedMs !== incumbent.observedMs) {
    return candidate.observedMs > incumbent.observedMs;
  }
  return candidate.row.createdAt > incumbent.row.createdAt;
}

/**
 * The answer set that was active at `atMs`: per item, the latest
 * evidence row observed at or before that moment, unless that row had
 * already been superseded by then with no later successor (a
 * retraction, e.g. the checklist's undo). Supersession by REPLACEMENT
 * needs no special case: the replacing row observes later and wins the
 * per-item race on its own.
 */
export function reconstructAnswersAsOf(
  evidence: readonly TrajectoryEvidenceRow[],
  atMs: number,
): MapAnswerInput[] {
  const winners = new Map<
    string,
    { observedMs: number; row: TrajectoryEvidenceRow }
  >();
  for (const row of evidence) {
    const observedMs = Date.parse(row.observedAt);
    if (!Number.isFinite(observedMs) || observedMs > atMs) continue;
    const candidate = { observedMs, row };
    const incumbent = winners.get(row.itemId);
    if (!incumbent || laterEvidence(candidate, incumbent)) {
      winners.set(row.itemId, candidate);
    }
  }
  const answers: MapAnswerInput[] = [];
  for (const winner of winners.values()) {
    const supersededMs = winner.row.supersededAt
      ? Date.parse(winner.row.supersededAt)
      : null;
    if (supersededMs !== null && supersededMs <= atMs) continue;
    answers.push({
      itemId: winner.row.itemId,
      answer: winner.row.answer,
    });
  }
  return answers.sort((a, b) => a.itemId.localeCompare(b.itemId));
}

/**
 * The trajectory chart's eras, oldest first, the live scoring last.
 * Archived eras rescore from the ledger where it reaches back that far
 * (renormalized, current basis); the rest keep stored numbers and their
 * stored basis fingerprint.
 */
export function buildTrajectoryEras(input: {
  /** Oldest first (child_reports.history is stored newest first). */
  archived: readonly ArchivedScoring[];
  live: { generated_at: string; scores: MapScores };
  evidence: readonly TrajectoryEvidenceRow[];
  /** The child's CURRENT recorded birth date, "YYYY-MM-DD". */
  birthDate: string;
}): TrajectoryEra[] {
  const liveBasis = currentBasisKey(input.birthDate);
  const eras: TrajectoryEra[] = input.archived.map((era) => {
    const atMs = Date.parse(era.generated_at);
    const answers = Number.isFinite(atMs)
      ? reconstructAnswersAsOf(input.evidence, atMs)
      : [];
    if (answers.length === 0) {
      return {
        generated_at: era.generated_at,
        scores: era.scores,
        renormalized: false,
        basisKey: storedBasisKey(era),
      };
    }
    return {
      generated_at: era.generated_at,
      scores: scoreMap(
        ageInMonths(input.birthDate, new Date(atMs)),
        answers,
      ),
      renormalized: true,
      basisKey: liveBasis,
    };
  });
  eras.push({
    generated_at: input.live.generated_at,
    scores: input.live.scores,
    renormalized: false,
    basisKey: liveBasis,
  });
  return eras;
}

/** True when any adjacent pair of eras was measured differently, which
 * is when the chart shows dotted boundary stretches and earns its
 * explanatory caption. */
export function trajectoryHasScaleChange(
  eras: readonly TrajectoryEra[],
): boolean {
  return eras.some(
    (era, index) =>
      index > 0 && era.basisKey !== eras[index - 1].basisKey,
  );
}
