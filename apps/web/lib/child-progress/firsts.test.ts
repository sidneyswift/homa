import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveChildFirsts } from "./firsts";
import type {
  ProgressConflict,
  ProgressEvidence,
  ProgressEvidenceAnswer,
  ProgressSourceKind,
} from "./types";

/**
 * The load-bearing tests here are the four laws: a regression, a
 * downgrade and a re-affirmation never move a line; a retraction removes
 * it; a resolved conflict retires the loser; an open conflict marks but
 * never removes. Each removal path from production has its own case,
 * because keying on source (the bug this rewrite fixes) passed every
 * other test while missing all of them.
 */

const BANK_A = "math.how-many-5";
const BANK_B = "phonics.first-sound";
const LITERACY = "literacy.uppercase-half";
const NO_ROSTER = { otherChildNames: [] as string[] };

let seq = 0;
function ev(overrides: Partial<ProgressEvidence> = {}): ProgressEvidence {
  seq += 1;
  return {
    id: `ev-${seq}`,
    childId: "child-1",
    familyId: "fam-1",
    itemId: BANK_A,
    answer: "easily" as ProgressEvidenceAnswer,
    source: "journal" as ProgressSourceKind,
    memberUserId: "user-1",
    adultDisplayName: "Alessa",
    quote: "Story did it",
    channel: "sms",
    messageId: `msg-${seq}`,
    checkInId: null,
    supersedesId: null,
    supersededAt: null,
    observedAt: "2026-03-03T15:00:00.000Z",
    createdAt: "2026-03-03T15:00:00.000Z",
    ...overrides,
  };
}

function derive(
  evidence: ProgressEvidence[],
  conflicts: ProgressConflict[] = [],
) {
  return deriveChildFirsts({ evidence, conflicts, gate: NO_ROSTER });
}

function resolved(
  fields: Partial<ProgressConflict> & {
    evidenceIdA: string;
    evidenceIdB: string;
    resolvedEvidenceId: string;
  },
): ProgressConflict {
  return {
    id: `c-${fields.evidenceIdA}`,
    childId: "child-1",
    familyId: "fam-1",
    itemId: BANK_A,
    observedAt: "2026-03-03T15:00:00.000Z",
    state: "resolved",
    resolvedAnswer: "not_yet",
    resolvedAt: "2026-04-01T00:00:00.000Z",
    ...fields,
  } as ProgressConflict;
}

function open(evidenceIdA: string, evidenceIdB: string): ProgressConflict {
  return {
    id: `oc-${evidenceIdA}`,
    childId: "child-1",
    familyId: "fam-1",
    itemId: BANK_A,
    observedAt: "2026-03-03T15:00:00.000Z",
    state: "open",
    resolvedAnswer: null,
    resolvedEvidenceId: null,
    resolvedAt: null,
    evidenceIdA,
    evidenceIdB,
  };
}

describe("deriveChildFirsts", () => {
  it("founds the first on min(observed_at) per item, never a later easily", () => {
    const first = ev({ observedAt: "2026-03-03T15:00:00.000Z", createdAt: "2026-03-03T15:00:00.000Z" });
    const later = ev({ observedAt: "2026-05-01T15:00:00.000Z", createdAt: "2026-05-01T15:00:00.000Z" });
    const firsts = derive([later, first]);
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].provenance.evidenceId, first.id);
  });

  it("orders strictly by date and never groups by subject", () => {
    const march = ev({ itemId: "science.predicts", observedAt: "2026-03-03T10:00:00.000Z", createdAt: "2026-03-03T10:00:00.000Z" });
    const april = ev({ itemId: BANK_A, observedAt: "2026-04-04T10:00:00.000Z", createdAt: "2026-04-04T10:00:00.000Z" });
    const firsts = derive([april, march]);
    assert.deepEqual(
      firsts.map((f) => f.provenance.itemId),
      ["science.predicts", BANK_A],
    );
  });

  it("breaks an observedAt tie by createdAt then ascii id, deterministically", () => {
    const a = ev({ id: "ev-b", itemId: BANK_A, observedAt: "2026-03-03T10:00:00.000Z", createdAt: "2026-03-03T10:00:00.000Z" });
    const b = ev({ id: "ev-a", itemId: BANK_B, observedAt: "2026-03-03T10:00:00.000Z", createdAt: "2026-03-03T10:00:00.000Z" });
    const once = derive([a, b]);
    const twice = derive([a, b]);
    assert.deepEqual(once, twice);
    // ev-a sorts before ev-b on the id tiebreak.
    assert.equal(once[0].provenance.evidenceId, "ev-a");
  });

  it("never founds a first from a not_yet or getting_there row", () => {
    assert.equal(derive([ev({ answer: "not_yet" })]).length, 0);
    assert.equal(derive([ev({ answer: "getting_there" })]).length, 0);
  });

  it("founds the first on the easily date when an item was getting_there earlier", () => {
    const early = ev({ answer: "getting_there", observedAt: "2026-02-01T10:00:00.000Z", createdAt: "2026-02-01T10:00:00.000Z" });
    const easily = ev({ answer: "easily", observedAt: "2026-04-01T10:00:00.000Z", createdAt: "2026-04-01T10:00:00.000Z" });
    const firsts = derive([early, easily]);
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].provenance.observedAt, "2026-04-01T10:00:00.000Z");
  });

  it("REGRESSION keeps the line: a later not_yet leaves the array unchanged", () => {
    const march = ev({ answer: "easily", observedAt: "2026-03-03T10:00:00.000Z", createdAt: "2026-03-03T10:00:00.000Z" });
    const withoutRegression = derive([march]);
    const july = ev({ answer: "not_yet", observedAt: "2026-07-01T10:00:00.000Z", createdAt: "2026-07-01T10:00:00.000Z" });
    const withRegression = derive([march, july]);
    assert.deepEqual(withRegression, withoutRegression);
  });

  it("DOWNGRADE keeps the line and the date: a correction to getting_there", () => {
    // The March easily is superseded and an active getting_there appended.
    const march = ev({ answer: "easily", observedAt: "2026-03-03T10:00:00.000Z", createdAt: "2026-03-03T10:00:00.000Z", supersededAt: "2026-07-01T10:00:00.000Z" });
    const july = ev({ answer: "getting_there", source: "report_correction", observedAt: "2026-07-01T10:00:00.000Z", createdAt: "2026-07-01T10:00:00.000Z", supersedesId: march.id });
    const firsts = derive([march, july]);
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].provenance.observedAt, "2026-03-03T10:00:00.000Z");
    assert.equal(firsts[0].provenance.quote, "Story did it");
  });

  it("RE-AFFIRMATION keeps the March date, not July", () => {
    const march = ev({ answer: "easily", observedAt: "2026-03-03T10:00:00.000Z", createdAt: "2026-03-03T10:00:00.000Z", supersededAt: "2026-07-01T10:00:00.000Z" });
    const july = ev({ answer: "easily", source: "report_correction", observedAt: "2026-07-01T10:00:00.000Z", createdAt: "2026-07-01T10:00:00.000Z", supersedesId: march.id });
    const firsts = derive([march, july]);
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].provenance.observedAt, "2026-03-03T10:00:00.000Z");
  });

  it("RETRACTION removes the line, delete path (superseded, nothing appended)", () => {
    const march = ev({ answer: "easily", supersededAt: "2026-07-01T10:00:00.000Z" });
    assert.equal(derive([march]).length, 0);
  });

  it("RETRACTION removes the line, undo path (single superseded row)", () => {
    const march = ev({ answer: "easily", supersededAt: "2026-07-02T10:00:00.000Z" });
    assert.equal(derive([march]).length, 0);
  });

  it("RETRACTION removes the line, batch undo (two items both superseded)", () => {
    const a = ev({ itemId: BANK_A, answer: "easily", supersededAt: "2026-07-01T10:00:00.000Z" });
    const b = ev({ itemId: BANK_B, answer: "easily", supersededAt: "2026-07-01T10:00:00.000Z" });
    assert.equal(derive([a, b]).length, 0);
  });

  it("legacy reconciliation churn does not delete history", () => {
    // A superseded founding row whose item still carries an active row
    // keeps its first, on the earliest date.
    const march = ev({ answer: "easily", observedAt: "2026-03-03T10:00:00.000Z", createdAt: "2026-03-03T10:00:00.000Z", supersededAt: "2026-07-01T10:00:00.000Z" });
    const active = ev({ answer: "easily", observedAt: "2026-07-01T10:00:00.000Z", createdAt: "2026-07-01T10:00:00.000Z", supersedesId: march.id });
    const firsts = derive([march, active]);
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].provenance.observedAt, "2026-03-03T10:00:00.000Z");
  });

  it("a resolved conflict settled AGAINST the easily row removes it", () => {
    const dad = ev({ id: "ev-dad", answer: "easily" });
    const mom = ev({ id: "ev-mom", answer: "not_yet" });
    const firsts = derive(
      [dad, mom],
      [resolved({ evidenceIdA: dad.id, evidenceIdB: mom.id, resolvedEvidenceId: mom.id, resolvedAnswer: "not_yet" })],
    );
    assert.equal(firsts.length, 0);
  });

  it("a resolved conflict settled FOR the easily row keeps the first", () => {
    const dad = ev({ id: "ev-dad", answer: "easily" });
    const mom = ev({ id: "ev-mom", answer: "not_yet" });
    const firsts = derive(
      [dad, mom],
      [resolved({ evidenceIdA: dad.id, evidenceIdB: mom.id, resolvedEvidenceId: dad.id, resolvedAnswer: "easily" })],
    );
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].provenance.evidenceId, "ev-dad");
  });

  it("an OPEN conflict on the founding row marks it contested but keeps it", () => {
    const march = ev({ id: "ev-mar", answer: "easily" });
    const other = ev({ id: "ev-oth", answer: "not_yet" });
    const firsts = derive([march, other], [open(march.id, other.id)]);
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].contested, true);
  });

  it("an open conflict on a different item leaves this first uncontested", () => {
    const a = ev({ id: "ev-a", itemId: BANK_A, answer: "easily" });
    const bOne = ev({ id: "ev-b1", itemId: BANK_B, answer: "easily" });
    const bTwo = ev({ id: "ev-b2", itemId: BANK_B, answer: "not_yet" });
    const firsts = derive([a, bOne, bTwo], [open(bOne.id, bTwo.id)]);
    const forA = firsts.find((f) => f.provenance.itemId === BANK_A);
    assert.equal(forA?.contested, false);
  });

  it("an onboarding_walk easily row never founds a first", () => {
    assert.equal(derive([ev({ source: "onboarding_walk", quote: null })]).length, 0);
  });

  it("a legacy-sourced easily row never founds a first", () => {
    assert.equal(derive([ev({ source: "legacy", quote: null })]).length, 0);
  });

  it("a walk row and a later journal row on the same item produce one first, dated the journal row", () => {
    const walk = ev({ source: "onboarding_walk", quote: null, observedAt: "2026-01-01T10:00:00.000Z", createdAt: "2026-01-01T10:00:00.000Z" });
    const journal = ev({ source: "journal", observedAt: "2026-04-01T10:00:00.000Z", createdAt: "2026-04-01T10:00:00.000Z" });
    const firsts = derive([walk, journal]);
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].provenance.observedAt, "2026-04-01T10:00:00.000Z");
  });

  it("a taxonomy row with no surviving quote produces no row; with a quote, one", () => {
    const tax = "computer_science.ai-and-fairness-in-decisions";
    assert.equal(derive([ev({ itemId: tax, source: "check_in", quote: null })]).length, 0);
    const withQuote = derive([ev({ itemId: tax, source: "journal", quote: "Story argued it in writing" })]);
    assert.equal(withQuote.length, 1);
  });

  it("skips an item id the catalog no longer resolves rather than throwing", () => {
    assert.doesNotThrow(() => derive([ev({ itemId: "gone.retired" })]));
    assert.equal(derive([ev({ itemId: "gone.retired" })]).length, 0);
  });

  it("an implied ability can never appear: only reported rows found firsts", () => {
    // A single easily row lights a prerequisite closure elsewhere, but
    // the derivation reads rows, so exactly one first appears.
    const firsts = derive([ev({ itemId: BANK_A, answer: "easily" })]);
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].provenance.itemId, BANK_A);
  });

  it("sets subjectMarker on the earliest first in each subject and nowhere else", () => {
    // BANK_A and BANK_B are both math/phonics; LITERACY is literacy.
    const mathOne = ev({ itemId: BANK_A, observedAt: "2026-03-01T10:00:00.000Z", createdAt: "2026-03-01T10:00:00.000Z" });
    const mathTwo = ev({ itemId: "math.counts-past-20", observedAt: "2026-03-10T10:00:00.000Z", createdAt: "2026-03-10T10:00:00.000Z" });
    const lit = ev({ itemId: LITERACY, observedAt: "2026-03-05T10:00:00.000Z", createdAt: "2026-03-05T10:00:00.000Z" });
    const firsts = derive([mathOne, mathTwo, lit]);
    const marked = firsts.filter((f) => f.subjectMarker !== null);
    // One marker for math, one for literacy.
    assert.equal(marked.length, 2);
    const markedSubjects = new Set(marked.map((f) => f.subjectMarker?.subjectId));
    assert.deepEqual([...markedSubjects].sort(), ["literacy", "math"]);
    // The math marker is on the earliest math row, not the later one.
    const mathMarked = firsts.find((f) => f.subjectMarker?.subjectId === "math");
    assert.equal(mathMarked?.provenance.itemId, BANK_A);
  });

  it("marks the top row as the beginning and no other row", () => {
    const march = ev({ itemId: BANK_A, observedAt: "2026-03-01T10:00:00.000Z", createdAt: "2026-03-01T10:00:00.000Z" });
    const april = ev({ itemId: BANK_B, observedAt: "2026-04-01T10:00:00.000Z", createdAt: "2026-04-01T10:00:00.000Z" });
    const firsts = derive([april, march]);
    assert.deepEqual(
      firsts.map((f) => f.isBeginning),
      [true, false],
    );
  });

  it("puts the beginning on a row that actually renders", () => {
    // A retired catalog id drops out after sorting, so the beginning
    // must land on the first SURVIVING row, never on a hole.
    const gone = ev({ itemId: "gone.retired", observedAt: "2026-01-01T10:00:00.000Z", createdAt: "2026-01-01T10:00:00.000Z" });
    const real = ev({ itemId: BANK_A, observedAt: "2026-03-01T10:00:00.000Z", createdAt: "2026-03-01T10:00:00.000Z" });
    const firsts = derive([gone, real]);
    assert.equal(firsts.length, 1);
    assert.equal(firsts[0].isBeginning, true);
  });

  it("marks no beginning when there are no rows", () => {
    assert.deepEqual(derive([]), []);
  });

  it("returns an empty array for a child with no qualifying rows", () => {
    assert.deepEqual(derive([]), []);
    assert.deepEqual(derive([ev({ answer: "not_yet" })]), []);
  });
});
