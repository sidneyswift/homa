import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { firstsPageFromLedger } from "./firsts-from-ledger";
import type { ChildProgressProjectionInput, StoredProgressEvidence } from "./repository";

/**
 * The adapter's job is to turn ledger rows into a payload a client may
 * hold. The tests hardest on it are the ones proving no ledger internal
 * and no count of firsts ever reaches that payload.
 */

const BANK_ID = "math.how-many-5";

let seq = 0;
function row(overrides: Partial<StoredProgressEvidence> = {}): StoredProgressEvidence {
  seq += 1;
  return {
    id: `ev-${seq}`,
    childId: "child-1",
    familyId: "fam-1",
    itemId: BANK_ID,
    answer: "easily",
    derivation: "direct",
    source: "journal",
    memberUserId: "user-1",
    adultDisplayName: "Alessa",
    quote: "Story counted five buttons",
    channel: "sms",
    messageId: `msg-${seq}`,
    checkInId: null,
    supersedesId: null,
    supersededAt: null,
    observedAt: "2026-03-03T15:00:00.000Z",
    createdAt: "2026-03-03T15:00:00.000Z",
    idempotencyKey: `key-${seq}`,
    ...overrides,
  };
}

function ledger(
  evidence: StoredProgressEvidence[],
  overrides: Partial<ChildProgressProjectionInput> = {},
): ChildProgressProjectionInput {
  return {
    child: { id: "child-1", name: "Story", birthDate: "2022-01-01" },
    familyId: "fam-1",
    timeZone: "America/New_York",
    sourceRevision: BigInt(1),
    evidence,
    conflicts: [],
    selectionAnswers: [],
    ...overrides,
  };
}

function page(
  evidence: StoredProgressEvidence[],
  otherChildNames: string[] = [],
  ledgerOverrides: Partial<ChildProgressProjectionInput> = {},
) {
  return firstsPageFromLedger({
    ledger: ledger(evidence, ledgerOverrides),
    otherChildNames,
  });
}

describe("firstsPageFromLedger", () => {
  it("renders dates in the ledger's own time zone", () => {
    // 2026-03-03T04:00Z is still March 2 in Los Angeles.
    const result = page(
      [row({ observedAt: "2026-03-03T04:00:00.000Z" })],
      [],
      { timeZone: "America/Los_Angeles" },
    );
    assert.match(result.rows[0].provenance.dateLabel, /Mar 2, 2026/);
  });

  it("takes childId and childName from ledger.child and copies no birthDate", () => {
    const result = page([row()]);
    assert.equal(result.childId, "child-1");
    assert.equal(result.childName, "Story");
    assert.ok(!JSON.stringify(result).includes("2022-01-01"));
  });

  it("separates the meta line with mid dots when the adult is known", () => {
    const result = page([row({ adultDisplayName: "Alessa" })]);
    assert.match(result.rows[0].provenance.metaLine, /Alessa · a note · /);
  });

  it("drops the adult segment when adultDisplayName is null", () => {
    const result = page([row({ adultDisplayName: null })]);
    const meta = result.rows[0].provenance.metaLine;
    assert.ok(!/Adult\s*\d/i.test(meta));
    assert.match(meta, /^a note · /);
  });

  it("uses the firsts source noun, never a progressSourceLabel string", () => {
    const result = page([row({ source: "report_correction", quote: null })]);
    assert.match(result.rows[0].provenance.metaLine, /a correction on the report/);
    assert.ok(!/Report correction/.test(result.rows[0].provenance.metaLine));
  });

  it("leads with the quote and carries the matched-ability line", () => {
    const result = page([row({ quote: "Story counted five buttons" })]);
    const r = result.rows[0];
    assert.deepEqual(r.lead, { kind: "quote", text: "Story counted five buttons" });
    assert.match(r.provenance.matchedAbilityLine ?? "", /Homa matched this to:/);
  });

  it("leads with the statement and a no-quote line when nothing was stored", () => {
    const result = page([row({ source: "check_in", quote: null })]);
    const r = result.rows[0];
    assert.equal(r.lead.kind, "statement");
    assert.ok(r.provenance.noQuoteLine !== null);
    assert.equal(r.provenance.matchedAbilityLine, null);
  });

  it("leads with the statement and NO no-quote line when the quote was suppressed", () => {
    const result = page(
      [row({ quote: "Story beat Ella to it" })],
      ["Ella"],
    );
    const r = result.rows[0];
    assert.equal(r.lead.kind, "statement");
    assert.equal(r.provenance.quote, null);
    assert.equal(r.provenance.noQuoteLine, null);
  });

  it("carries the beginning on the top row only, named for this child", () => {
    const result = page([
      row({ itemId: "math.how-many-5", observedAt: "2026-03-01T10:00:00.000Z", createdAt: "2026-03-01T10:00:00.000Z" }),
      row({ itemId: "phonics.first-sound", observedAt: "2026-04-01T10:00:00.000Z", createdAt: "2026-04-01T10:00:00.000Z" }),
    ]);
    assert.equal(result.rows[0].beginning?.heading, "Where the record starts");
    assert.match(result.rows[0].beginning?.body ?? "", /you told me about Story/);
    assert.equal(result.rows[1].beginning, null);
  });

  it("populates the contested line only for a contested first", () => {
    const uncontested = page([row()]);
    assert.equal(uncontested.rows[0].contestedLine, null);
  });

  it("omits the channel line for a null channel", () => {
    const result = page([row({ channel: null })]);
    assert.equal(result.rows[0].provenance.channelLine, null);
  });

  it("carries no ledger internals in the serialized payload", () => {
    const serialized = JSON.stringify(page([row()]));
    for (const key of [
      "memberUserId",
      "familyId",
      "idempotencyKey",
      "supersededAt",
      "supersedesId",
      "sourceRevision",
      "checkInId",
      "messageId",
    ]) {
      assert.ok(!serialized.includes(`"${key}"`), `payload leaked ${key}`);
    }
  });

  it("carries no count of firsts and no number that is not part of a date", () => {
    const result = page([row(), row({ itemId: "phonics.first-sound" })]);
    // Walk every value; the only bare numbers allowed are inside date
    // labels, which are strings.
    const serialized = JSON.stringify(result);
    assert.ok(!/"(count|total|rowCount|firstsCount)"/.test(serialized));
  });

  it("returns an empty rows array with childId and childName for a bare ledger", () => {
    const result = page([]);
    assert.deepEqual(result.rows, []);
    assert.equal(result.childId, "child-1");
    assert.equal(result.childName, "Story");
  });

  it("threads the roster to the gate: sibling name in a quote demotes the lead", () => {
    const withoutRoster = page([row({ quote: "Story did it with help" })], []);
    assert.equal(withoutRoster.rows[0].lead.kind, "quote");
    const withRoster = page([row({ quote: "Story did it before Ella" })], ["Ella"]);
    assert.equal(withRoster.rows[0].lead.kind, "statement");
  });
});
