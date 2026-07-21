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
 * Re-normalized eras for the trajectory chart, ported verbatim from
 * apps/web/lib/map/trajectory-eras.ts (the mixed-scales fix; keep in
 * sync). At render time each archived era's answer set is reconstructed
 * from the append-only evidence ledger and rescored under the CURRENT
 * bank + scorer + birthday, so the line shows only child movement. Eras
 * the ledger cannot reconstruct keep their stored numbers and basis and
 * the chart draws an honest scale boundary between differently measured
 * neighbors. Pure functions, no I/O: lib/progress.ts fetches the rows.
 */

/** One stored scoring as archived in child_reports.history. Basis
 * stamps exist on entries written after migration #78; older entries
 * read as "basis unknown". */
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
  /** Fingerprint of the measuring stick behind these scores. */
  basisKey: string;
}

const UNKNOWN_BASIS_PART = "unknown";

/** The fingerprint of today's measuring stick for this child. */
export function currentBasisKey(birthDate: string): string {
  return [MAP_BANK_VERSION, MAP_SCORER_VERSION, birthDate].join("|");
}

/** A stored era's fingerprint. Missing stamps read as unknown, which
 * never equals the current basis: an archive that cannot prove it was
 * measured the same way gets the honest boundary. */
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
 * already been superseded by then with no later successor.
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
 * Stored scorings predate the scorer's raw fields, so a JSON-parsed era
 * can carry `undefined` where fresh scores carry numbers. Eras the
 * ledger can reach get the raw fields filled by rescoring that day's
 * answers; display fields stay exactly as stored. Unreachable eras
 * normalize the missing fields to null: no number is invented.
 */
function withRawFields(
  scores: MapScores,
  evidence: readonly TrajectoryEvidenceRow[],
  birthDate: string,
  atMs: number,
): MapScores {
  const missing = scores.subjects.some(
    (subject) => subject.frontierDeltaMonths === undefined,
  );
  if (!missing) return scores;

  const answers = Number.isFinite(atMs)
    ? reconstructAnswersAsOf(evidence, atMs)
    : [];
  const raw =
    answers.length > 0
      ? new Map(
          scoreMap(
            ageInMonths(birthDate, new Date(atMs)),
            answers,
          ).subjects.map((subject) => [subject.subjectId, subject]),
        )
      : new Map<
          string,
          {
            frontierDeltaMonths: number | null;
            strongestObservedMonths: number | null;
          }
        >();

  return {
    ...scores,
    subjects: scores.subjects.map((subject) => ({
      ...subject,
      frontierDeltaMonths:
        subject.frontierDeltaMonths ??
        raw.get(subject.subjectId)?.frontierDeltaMonths ??
        null,
      strongestObservedMonths:
        subject.strongestObservedMonths ??
        raw.get(subject.subjectId)?.strongestObservedMonths ??
        null,
    })),
  };
}

/**
 * The trajectory chart's eras, oldest first, the live scoring last.
 * Archived eras rescore from the ledger where it reaches back that far;
 * the rest keep stored numbers and their stored basis fingerprint.
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
        scores: withRawFields(
          era.scores,
          input.evidence,
          input.birthDate,
          atMs,
        ),
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
    scores: withRawFields(
      input.live.scores,
      input.evidence,
      input.birthDate,
      Date.parse(input.live.generated_at),
    ),
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
    (era, index) => index > 0 && era.basisKey !== eras[index - 1].basisKey,
  );
}
