import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProvenanceRecord, humanAuthoredQuote } from "./provenance";
import type { ProgressEvidence, ProgressSourceKind } from "./types";

/**
 * Two fences under test. A model-authored clause never renders as a
 * human's words, and a taxonomy row with no surviving quote never
 * renders at all. Both are the difference between a receipt and a
 * curriculum label.
 */

const BANK_ID = "math.how-many-5"; // getMapItem resolves: a bank sentence
const TAXONOMY_ID = "computer_science.ai-and-fairness-in-decisions"; // topic name only
const NO_ROSTER = { otherChildNames: [] as string[] };

function evidence(overrides: Partial<ProgressEvidence> = {}): ProgressEvidence {
  return {
    id: "ev-1",
    childId: "child-1",
    familyId: "fam-1",
    itemId: BANK_ID,
    answer: "easily",
    derivation: "direct",
    source: "journal",
    memberUserId: "user-1",
    adultDisplayName: "Alessa",
    quote: "Story counted five buttons all by himself",
    channel: "sms",
    messageId: "msg-1",
    checkInId: null,
    supersedesId: null,
    supersededAt: null,
    observedAt: "2026-03-03T15:00:00.000Z",
    createdAt: "2026-03-03T15:00:01.000Z",
    ...overrides,
  };
}

describe("humanAuthoredQuote", () => {
  it("carries a journal and a conversation quote", () => {
    assert.equal(
      humanAuthoredQuote(evidence({ source: "journal" })),
      "Story counted five buttons all by himself",
    );
    assert.equal(
      humanAuthoredQuote(evidence({ source: "conversation" })),
      "Story counted five buttons all by himself",
    );
  });

  it("drops a lesson_listen quote as not a human's words", () => {
    // The column is populated, but the string is a model-written clause.
    assert.equal(
      humanAuthoredQuote(evidence({ source: "lesson_listen" })),
      null,
    );
  });

  it("drops the quote for every non-journal, non-conversation source", () => {
    const sources: ProgressSourceKind[] = [
      "check_in",
      "checklist",
      "deep_dive",
      "correction",
      "report_correction",
      "report_probe",
      "recheck",
      "onboarding_walk",
      "legacy",
      "lesson_listen",
    ];
    for (const source of sources) {
      assert.equal(
        humanAuthoredQuote(evidence({ source })),
        null,
        `source ${source} must not be treated as a human's own words`,
      );
    }
  });
});

describe("buildProvenanceRecord", () => {
  it("carries a journal quote through as the adult's own words", () => {
    const record = buildProvenanceRecord(evidence(), NO_ROSTER);
    assert.equal(record?.quote, "Story counted five buttons all by himself");
    assert.equal(record?.quoteSuppressed, false);
  });

  it("drops a lesson_listen quote to null with quoteSuppressed false", () => {
    const record = buildProvenanceRecord(
      evidence({ source: "lesson_listen" }),
      NO_ROSTER,
    );
    assert.equal(record?.quote, null);
    assert.equal(record?.quoteSuppressed, false);
  });

  it("suppresses a journal quote that names a sibling", () => {
    const record = buildProvenanceRecord(
      evidence({ quote: "Story read it before Ella did" }),
      { otherChildNames: ["Ella"] },
    );
    assert.equal(record?.quote, null);
    assert.equal(record?.quoteSuppressed, true);
  });

  it("suppresses a journal quote containing 'behind'", () => {
    const record = buildProvenanceRecord(
      evidence({ quote: "I was afraid he was behind" }),
      NO_ROSTER,
    );
    assert.equal(record?.quote, null);
    assert.equal(record?.quoteSuppressed, true);
  });

  it("a check_in row with a null quote is quoteSuppressed false", () => {
    // So the renderer may honestly say no words were saved.
    const record = buildProvenanceRecord(
      evidence({ source: "check_in", quote: null }),
      NO_ROSTER,
    );
    assert.equal(record?.quote, null);
    assert.equal(record?.quoteSuppressed, false);
  });

  it("a bank item with a suppressed quote still returns a record", () => {
    // The authored bank statement can carry the row without her words.
    const record = buildProvenanceRecord(
      evidence({ quote: "Story beat Ella to it" }),
      { otherChildNames: ["Ella"] },
    );
    assert.notEqual(record, null);
    assert.equal(record?.isBankStatement, true);
    assert.equal(record?.quote, null);
  });

  it("a taxonomy item with a suppressed quote returns null", () => {
    // A bare topic name under a date is not a receipt.
    const record = buildProvenanceRecord(
      evidence({ itemId: TAXONOMY_ID, quote: "Story beat Ella to it" }),
      { otherChildNames: ["Ella"] },
    );
    assert.equal(record, null);
  });

  it("a taxonomy item with a gate-passing quote returns a record", () => {
    const record = buildProvenanceRecord(
      evidence({ itemId: TAXONOMY_ID, quote: "Story argued it out in writing" }),
      NO_ROSTER,
    );
    assert.notEqual(record, null);
    assert.equal(record?.isBankStatement, false);
    assert.equal(record?.quote, "Story argued it out in writing");
  });

  it("isBankStatement distinguishes bank from taxonomy", () => {
    assert.equal(buildProvenanceRecord(evidence(), NO_ROSTER)?.isBankStatement, true);
    assert.equal(
      buildProvenanceRecord(
        evidence({ itemId: TAXONOMY_ID, source: "journal" }),
        NO_ROSTER,
      )?.isBankStatement,
      false,
    );
  });

  it("returns null for an unresolvable item id rather than throwing", () => {
    assert.equal(
      buildProvenanceRecord(evidence({ itemId: "nope.not-real" }), NO_ROSTER),
      null,
    );
  });

  it("carries no ledger internals into the record", () => {
    const record = buildProvenanceRecord(evidence(), NO_ROSTER);
    assert.notEqual(record, null);
    const forbidden = [
      "memberUserId",
      "familyId",
      "idempotencyKey",
      "messageId",
      "supersedesId",
      "supersededAt",
      "checkInId",
      "childId",
    ];
    for (const key of forbidden) {
      assert.ok(
        !Object.prototype.hasOwnProperty.call(record, key),
        `record must not carry ${key}`,
      );
    }
  });

  it("passes adultDisplayName through unchanged, including null", () => {
    assert.equal(
      buildProvenanceRecord(evidence({ adultDisplayName: "Alessa" }), NO_ROSTER)
        ?.adultDisplayName,
      "Alessa",
    );
    assert.equal(
      buildProvenanceRecord(evidence({ adultDisplayName: null }), NO_ROSTER)
        ?.adultDisplayName,
      null,
    );
  });
});
