import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";
import type {
  OpenProgressConflict,
  ProgressConflict,
  ProgressEvidence,
  ResolvedProgressConflict,
} from "./types";

export { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";

interface TimedProgressEvidence {
  evidence: ProgressEvidence;
  observedAtEpochNanoseconds: bigint;
  createdAtEpochNanoseconds: bigint;
}

interface TimedResolvedProgressConflict {
  conflict: ResolvedProgressConflict;
  resolvedAtEpochNanoseconds: bigint;
}

export interface EffectiveProgressEvidenceResult {
  effectiveEvidence: ProgressEvidence[];
  openConflicts: OpenProgressConflict[];
}

function compareAsciiIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function parseEntityTimestamp(
  value: string,
  field: string,
  entityKind: "progress evidence" | "progress conflict",
  entityId: string,
): bigint {
  try {
    return parseOffsetIsoTimestampEpochNanoseconds(value);
  } catch {
    throw new TypeError(
      `Invalid ${field} "${value}" for ${entityKind} "${entityId}"`,
    );
  }
}

function assertExpectedScope(
  entity: ProgressEvidence | ProgressConflict,
  entityKind: "Progress evidence" | "Progress conflict",
  childId: string,
  familyId: string,
): void {
  if (entity.childId === childId && entity.familyId === familyId) return;
  throw new TypeError(
    `${entityKind} "${entity.id}" belongs to child "${entity.childId}" in family "${entity.familyId}"; expected child "${childId}" in family "${familyId}"`,
  );
}

function parseEvidenceRows(
  evidenceRows: readonly ProgressEvidence[],
  childId: string,
  familyId: string,
): TimedProgressEvidence[] {
  return evidenceRows.map((evidence) => {
    assertExpectedScope(
      evidence,
      "Progress evidence",
      childId,
      familyId,
    );
    const observedAtEpochNanoseconds = parseEntityTimestamp(
      evidence.observedAt,
      "observedAt",
      "progress evidence",
      evidence.id,
    );
    const createdAtEpochNanoseconds = parseEntityTimestamp(
      evidence.createdAt,
      "createdAt",
      "progress evidence",
      evidence.id,
    );
    if (evidence.supersededAt !== null) {
      parseEntityTimestamp(
        evidence.supersededAt,
        "supersededAt",
        "progress evidence",
        evidence.id,
      );
    }
    return {
      evidence,
      observedAtEpochNanoseconds,
      createdAtEpochNanoseconds,
    };
  });
}

function parseAndValidateConflicts(
  conflicts: readonly ProgressConflict[],
  evidenceById: ReadonlyMap<string, ProgressEvidence>,
  childId: string,
  familyId: string,
): void {
  const openItemIds = new Set<string>();
  for (const conflict of conflicts) {
    assertExpectedScope(
      conflict,
      "Progress conflict",
      childId,
      familyId,
    );
    parseEntityTimestamp(
      conflict.observedAt,
      "observedAt",
      "progress conflict",
      conflict.id,
    );
    if (conflict.state === "resolved") {
      parseEntityTimestamp(
        conflict.resolvedAt,
        "resolvedAt",
        "progress conflict",
        conflict.id,
      );
    } else {
      if (openItemIds.has(conflict.itemId)) {
        throw new TypeError(
          `More than one open progress conflict exists for item "${conflict.itemId}"`,
        );
      }
      openItemIds.add(conflict.itemId);
    }

    for (const evidenceId of [
      conflict.evidenceIdA,
      conflict.evidenceIdB,
    ]) {
      const linkedEvidence = evidenceById.get(evidenceId);
      if (
        linkedEvidence === undefined ||
        linkedEvidence.itemId !== conflict.itemId
      ) {
        throw new TypeError(
          `Progress conflict "${conflict.id}" references missing or mismatched evidence "${evidenceId}"`,
        );
      }
      if (
        conflict.state === "open" &&
        linkedEvidence.supersededAt !== null
      ) {
        throw new TypeError(
          `Open progress conflict "${conflict.id}" references superseded evidence "${evidenceId}"`,
        );
      }
    }

    if (conflict.state === "resolved") {
      const resolvedEvidence = evidenceById.get(
        conflict.resolvedEvidenceId,
      );
      if (
        resolvedEvidence === undefined ||
        resolvedEvidence.itemId !== conflict.itemId ||
        resolvedEvidence.answer !== conflict.resolvedAnswer
      ) {
        throw new TypeError(
          `Progress conflict "${conflict.id}" has invalid resolved evidence "${conflict.resolvedEvidenceId}"`,
        );
      }
    }
  }
}

function isLaterEvidence(
  candidate: TimedProgressEvidence,
  current: TimedProgressEvidence,
): boolean {
  if (
    candidate.observedAtEpochNanoseconds !==
    current.observedAtEpochNanoseconds
  ) {
    return (
      candidate.observedAtEpochNanoseconds >
      current.observedAtEpochNanoseconds
    );
  }
  if (
    candidate.createdAtEpochNanoseconds !==
    current.createdAtEpochNanoseconds
  ) {
    return (
      candidate.createdAtEpochNanoseconds >
      current.createdAtEpochNanoseconds
    );
  }
  return compareAsciiIds(candidate.evidence.id, current.evidence.id) > 0;
}

function latestActiveEvidenceByItem(
  timedEvidence: readonly TimedProgressEvidence[],
): Map<string, TimedProgressEvidence> {
  const latestByItem = new Map<string, TimedProgressEvidence>();
  for (const candidate of timedEvidence) {
    if (candidate.evidence.supersededAt !== null) continue;
    const current = latestByItem.get(candidate.evidence.itemId);
    if (current === undefined || isLaterEvidence(candidate, current)) {
      latestByItem.set(candidate.evidence.itemId, candidate);
    }
  }
  return latestByItem;
}

function latestResolvedConflictByItem(
  conflicts: readonly ProgressConflict[],
): Map<string, TimedResolvedProgressConflict> {
  const latestByItem = new Map<
    string,
    TimedResolvedProgressConflict
  >();
  for (const conflict of conflicts) {
    if (conflict.state !== "resolved") continue;
    const candidate: TimedResolvedProgressConflict = {
      conflict,
      resolvedAtEpochNanoseconds:
        parseOffsetIsoTimestampEpochNanoseconds(
          conflict.resolvedAt,
        ),
    };
    const current = latestByItem.get(conflict.itemId);
    if (
      current === undefined ||
      candidate.resolvedAtEpochNanoseconds >
        current.resolvedAtEpochNanoseconds ||
      (candidate.resolvedAtEpochNanoseconds ===
        current.resolvedAtEpochNanoseconds &&
        compareAsciiIds(conflict.id, current.conflict.id) > 0)
    ) {
      latestByItem.set(conflict.itemId, candidate);
    }
  }
  return latestByItem;
}

/**
 * Resolves the ledger into one scoreable observation per item while
 * preserving open conflicts for the live projection.
 */
export function resolveEffectiveProgressEvidence(input: {
  childId: string;
  familyId: string;
  evidence: readonly ProgressEvidence[];
  conflicts: readonly ProgressConflict[];
}): EffectiveProgressEvidenceResult {
  const timedEvidence = parseEvidenceRows(
    input.evidence,
    input.childId,
    input.familyId,
  );
  const evidenceById = new Map(
    input.evidence.map((evidence) => [evidence.id, evidence]),
  );
  const timedEvidenceById = new Map(
    timedEvidence.map((timed) => [timed.evidence.id, timed]),
  );
  parseAndValidateConflicts(
    input.conflicts,
    evidenceById,
    input.childId,
    input.familyId,
  );

  const openConflicts = input.conflicts
    .filter(
      (conflict): conflict is OpenProgressConflict =>
        conflict.state === "open",
    )
    .sort(
      (left, right) =>
        compareAsciiIds(left.itemId, right.itemId) ||
        compareAsciiIds(left.id, right.id),
    );
  const openConflictItems = new Set(
    openConflicts.map((conflict) => conflict.itemId),
  );
  const latestActiveByItem =
    latestActiveEvidenceByItem(timedEvidence);
  const latestResolvedByItem =
    latestResolvedConflictByItem(input.conflicts);
  const itemIds = new Set([
    ...latestActiveByItem.keys(),
    ...latestResolvedByItem.keys(),
  ]);
  const effectiveEvidence: ProgressEvidence[] = [];

  for (const itemId of itemIds) {
    if (openConflictItems.has(itemId)) continue;
    const timedResolvedConflict = latestResolvedByItem.get(itemId);
    if (timedResolvedConflict !== undefined) {
      const resolvedConflict = timedResolvedConflict.conflict;
      const resolvedEvidence = evidenceById.get(
        resolvedConflict.resolvedEvidenceId,
      );
      if (
        resolvedEvidence !== undefined &&
        resolvedEvidence.supersededAt === null
      ) {
        const resolvedTimedEvidence = timedEvidenceById.get(
          resolvedEvidence.id,
        );
        if (resolvedTimedEvidence === undefined) {
          throw new TypeError(
            `Progress conflict "${resolvedConflict.id}" is missing timed resolved evidence "${resolvedEvidence.id}"`,
          );
        }
        let selectedEvidence = resolvedTimedEvidence;
        for (const candidate of timedEvidence) {
          if (
            candidate.evidence.itemId !== itemId ||
            candidate.evidence.supersededAt !== null ||
            candidate.evidence.id === resolvedEvidence.id ||
            candidate.createdAtEpochNanoseconds <=
              timedResolvedConflict.resolvedAtEpochNanoseconds
          ) {
            continue;
          }
          if (isLaterEvidence(candidate, selectedEvidence)) {
            selectedEvidence = candidate;
          }
        }
        effectiveEvidence.push(selectedEvidence.evidence);
        continue;
      }
    }
    const latestEvidence = latestActiveByItem.get(itemId);
    if (latestEvidence !== undefined) {
      effectiveEvidence.push(latestEvidence.evidence);
    }
  }

  effectiveEvidence.sort((left, right) =>
    compareAsciiIds(left.itemId, right.itemId),
  );
  return { effectiveEvidence, openConflicts };
}
