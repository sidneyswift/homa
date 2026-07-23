import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";
import { buildProvenanceRecord, type ProvenanceRecord } from "./provenance";
import type { QuoteGateContext } from "./quote-gate";
import type {
  ProgressConflict,
  ProgressEvidence,
  ProgressSourceKind,
} from "./types";

/**
 * The deterministic derivation of one child's firsts.
 *
 * Four laws, each load-bearing:
 *
 * 1. An implied ability can never appear. Implied abilities are not
 *    rows, and this reads rows only.
 * 2. A regression, a downgrade and a re-affirmation never move or remove
 *    a line (spec R3 and section 5E: "History does not un-happen"). A
 *    superseded row is still a day that happened, so it stays a
 *    candidate; a line only leaves when nothing is left standing on its
 *    item at all.
 * 3. A record the family took back does leave, because a celebration may
 *    not assert what a parent removed. That is the one removal, and it is
 *    source-blind: it fires when every row on an item was superseded with
 *    nothing appended, or when a row lost a resolved conflict.
 * 4. The page is ordered strictly by date and never grouped by subject.
 */

/** Answers stamped with the request clock about abilities the child
 *  already had. walk-prompt-store.ts sets observedAt to now for a whole
 *  signup sitting, those rows carry quote null, and bank.ts says the
 *  bank asks what is "answerable from memory". Fifteen of them share one
 *  instant and none is a day something happened. `legacy` is the same
 *  shape, migrated. Neither may found a first. */
const RECOLLECTION_SOURCES: ReadonlySet<ProgressSourceKind> = new Set([
  "onboarding_walk",
  "legacy",
]);

export interface ChildFirst {
  /** The row that founded it, and the only receipt this line makes. */
  provenance: ProvenanceRecord;
  /** True when an open conflict names the founding row. The line stays
   *  and says so; a disagreement is not a retraction. */
  contested: boolean;
  /** Set on the earliest first in each subject, so the page can name
   *  where a subject came into the record. Null everywhere else. */
  subjectMarker: { subjectId: string; displayName: string } | null;
}

/** left === right ? 0 : (left < right ? -1 : 1). Reimplemented here
 *  rather than imported: the private helpers in effective-evidence.ts
 *  and projection.ts are identical, and this module breaks ties as the
 *  exact inverse of effective-evidence's isLaterEvidence so a first
 *  never moves between renders. */
function compareAsciiIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

interface TimedRow {
  evidence: ProgressEvidence;
  observedNs: bigint;
  createdNs: bigint;
}

/** Earliest first: smallest observedAt ns, then smallest createdAt ns,
 *  then ascii id ascending. The exact inverse of isLaterEvidence. */
function isEarlier(candidate: TimedRow, current: TimedRow): boolean {
  if (candidate.observedNs !== current.observedNs) {
    return candidate.observedNs < current.observedNs;
  }
  if (candidate.createdNs !== current.createdNs) {
    return candidate.createdNs < current.createdNs;
  }
  return compareAsciiIds(candidate.evidence.id, current.evidence.id) < 0;
}

export function deriveChildFirsts(input: {
  evidence: readonly ProgressEvidence[];
  conflicts: readonly ProgressConflict[];
  gate: QuoteGateContext;
}): ChildFirst[] {
  // 1. Rows that lost a resolved conflict. Conflict resolution calls
  //    resolveProgressConflict and nothing else (check-in-service.ts has
  //    no supersedeEvidence call), so the losing row stays active and
  //    unsuperseded forever; effective-evidence.ts copes by selecting the
  //    winner at read time, machinery this module bypasses. Without this,
  //    a row the household settled AGAINST would found a first.
  const retiredEvidenceIds = new Set<string>();
  for (const conflict of input.conflicts) {
    if (conflict.state !== "resolved") continue;
    const loser =
      conflict.evidenceIdA === conflict.resolvedEvidenceId
        ? conflict.evidenceIdB
        : conflict.evidenceIdA;
    retiredEvidenceIds.add(loser);
  }

  // 2. Rows named by an open conflict. Used for `contested` only; it does
  //    NOT remove a candidate. Conflicts open with evidenceIdA set to the
  //    previous effective row, which for a one-row item IS the founding
  //    row, so skipping it would silently delete a mother's own sentence
  //    the moment a second adult tapped a different answer.
  const openConflictEvidenceIds = new Set<string>();
  for (const conflict of input.conflicts) {
    if (conflict.state !== "open") continue;
    openConflictEvidenceIds.add(conflict.evidenceIdA);
    openConflictEvidenceIds.add(conflict.evidenceIdB);
  }

  // 3. Withdrawn items: an item with zero rows that are both
  //    unsuperseded and not retired by a resolved conflict. This is the
  //    ONLY removal test, and it is source-blind on purpose. Every
  //    retraction path (correctProgressAnswers with a null or not_sure
  //    answer, undoProgressEvidence, undoProgressOperation, the walk
  //    coverage path) supersedes without appending, so keying on a
  //    sibling row's source missed all of them and would additionally let
  //    a client choose the outcome, since the correct route reads
  //    `source` from the request body.
  const activeCountByItem = new Map<string, number>();
  for (const row of input.evidence) {
    if (row.supersededAt !== null) continue;
    if (retiredEvidenceIds.has(row.id)) continue;
    activeCountByItem.set(
      row.itemId,
      (activeCountByItem.get(row.itemId) ?? 0) + 1,
    );
  }
  const isWithdrawn = (itemId: string): boolean =>
    (activeCountByItem.get(itemId) ?? 0) === 0;

  // 4. Candidates. Note what is deliberately absent: there is no
  //    supersededAt === null test. A superseded row is still a day that
  //    happened, which is what makes a regression, a downgrade and a
  //    re-affirmation all leave the date alone. `easily` only: a page of
  //    firsts built from getting_there and not_yet opens with the things
  //    a child could not do, a deficit ledger wearing a celebration's
  //    name.
  const foundingByItem = new Map<string, TimedRow>();
  for (const row of input.evidence) {
    if (row.answer !== "easily") continue;
    if (RECOLLECTION_SOURCES.has(row.source)) continue;
    if (retiredEvidenceIds.has(row.id)) continue;
    if (isWithdrawn(row.itemId)) continue;
    if (buildProvenanceRecord(row, input.gate) === null) continue;

    const timed: TimedRow = {
      evidence: row,
      observedNs: parseOffsetIsoTimestampEpochNanoseconds(row.observedAt),
      createdNs: parseOffsetIsoTimestampEpochNanoseconds(row.createdAt),
    };
    const current = foundingByItem.get(row.itemId);
    // 5. Founding row per item: the minimum by (observedAt, createdAt,
    //    id). Do NOT walk forward to a later row when the earliest is
    //    unrenderable: buildProvenanceRecord already handles renderability
    //    by falling back to the bank statement, so choosing a first's
    //    date by what happens to render would make the date an artifact
    //    of the filter.
    if (current === undefined || isEarlier(timed, current)) {
      foundingByItem.set(row.itemId, timed);
    }
  }

  // 6. Sort the surviving founding rows ascending by the same triple.
  const founding = [...foundingByItem.values()].sort((left, right) =>
    isEarlier(left, right) ? -1 : isEarlier(right, left) ? 1 : 0,
  );

  // 7 + 8. Build each first; mark the earliest per subject.
  const seenSubjects = new Set<string>();
  const firsts: ChildFirst[] = [];
  for (const timed of founding) {
    // Non-null: this row already produced a record inside the candidate
    // filter above, and buildProvenanceRecord is pure over the same
    // inputs.
    const provenance = buildProvenanceRecord(timed.evidence, input.gate);
    if (provenance === null) continue;
    const subjectMarker = seenSubjects.has(provenance.subjectId)
      ? null
      : { subjectId: provenance.subjectId, displayName: provenance.subjectDisplayName };
    seenSubjects.add(provenance.subjectId);
    firsts.push({
      provenance,
      contested: openConflictEvidenceIds.has(timed.evidence.id),
      subjectMarker,
    });
  }
  return firsts;
}
