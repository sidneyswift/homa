import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMapItem, getMapSubject } from "@homa/core";

import { selectSubjectDeepDiveQuestion } from "./deep-dive-selection";
import type { ProgressEvidence, ProgressSelectionAnswer } from "./types";

const now = new Date("2026-09-06T12:00:00.000Z");
const fresh = now.toISOString();
const old = "2026-07-01T12:00:00.000Z";
function evidence(itemId: string, answer: ProgressEvidence["answer"], observedAt = fresh, derivation: ProgressEvidence["derivation"] = "direct"): ProgressEvidence {
  assert.ok(getMapItem(itemId), `Fixture item ${itemId} exists in the bank`);
  return { id: itemId, childId: "child", familyId: "family", itemId, answer,
    observedAt, createdAt: observedAt, derivation, source: "check_in", memberUserId: "adult", adultDisplayName: "Parent",
    quote: null, channel: "web", messageId: null, checkInId: null, supersedesId: null, supersededAt: null };
}
function select(rows: ProgressEvidence[] = [], overrides: Partial<Parameters<typeof selectSubjectDeepDiveQuestion>[0]> = {}) {
  return selectSubjectDeepDiveQuestion({ childId: "child", familyId: "family", subjectId: "gross_motor", ageMonths: 48, now,
    evidence: rows, conflicts: [], selectionAnswers: [], sittingItemIds: [], ...overrides });
}
function selectedId(decision: ReturnType<typeof select>) {
  return decision.kind === "question" ? decision.item.id : decision.reason;
}
function uncertain(itemId: string, answer: "skip" | "not_sure", answeredAt: string): ProgressSelectionAnswer {
  return {selectionId: itemId, childId: "child", familyId: "family", evidenceId: null, itemId, answer, answeredAt};
}

describe("requested deeper questions", () => {
  it("starts at age only without useful evidence", () => {
    assert.equal(selectedId(select()), "gross_motor.gallops");
  });

  it("passes the ordinary age ladder after a fresh stronger answer", () => {
    const rows = [evidence("gross_motor.pedals", "easily", old), evidence("gross_motor.gallops", "easily", old),
      evidence("gross_motor.one-foot-hop", "easily", old), evidence("gross_motor.catches-ball", "easily")];
    assert.equal(selectedId(select(rows)), "gross_motor.skips");
  });

  it("asks an easier supported ability after not yet", () => {
    assert.equal(selectedId(select([evidence("gross_motor.gallops", "not_yet")])), "gross_motor.pedals");
  });

  it("refreshes the stale emerging edge, then goes beyond the old ladder", () => {
    const rows = [evidence("fine_motor.beads", "easily", old), evidence("fine_motor.cuts-line", "getting_there", old), evidence("fine_motor.pours", "easily")];
    const next = select(rows, {subjectId: "fine_motor"});
    assert.equal(selectedId(next), "fine_motor.cuts-line");
    assert.equal(next.kind === "question" && next.reason, "refresh");
    rows[1] = evidence("fine_motor.cuts-line", "easily");
    assert.equal(selectedId(select(rows, {subjectId: "fine_motor", sittingItemIds: ["fine_motor.cuts-line"]})), "fine_motor.puzzle-20");
  });

  it("uses a current emerging edge without asking the same question again", () => {
    const next = select([evidence("gross_motor.catches-ball", "getting_there")]);
    assert.equal(selectedId(next), "gross_motor.skips");
  });

  it("does not silently treat inferred or unknown evidence as a current answer", () => {
    for (const derivation of ["inferred", "unknown"] as const) {
      const next = select([evidence("gross_motor.catches-ball", "easily", fresh, derivation)]);
      assert.equal(selectedId(next), "gross_motor.catches-ball");
      assert.equal(next.kind === "question" && next.reason, "confirm_source");
    }
  });

  it("can reconsider old uncertainty while respecting recent or sitting skips", () => {
    for (const answer of ["skip", "not_sure"] as const) {
      assert.equal(selectedId(select([], {selectionAnswers: [uncertain("gross_motor.gallops", answer, old)]})), "gross_motor.gallops");
      assert.notEqual(selectedId(select([], {selectionAnswers: [uncertain("gross_motor.gallops", answer, fresh)]})), "gross_motor.gallops");
      assert.notEqual(selectedId(select([], {sittingItemIds: ["gross_motor.gallops"]})), "gross_motor.gallops");
    }
  });

  it("ignores another child or family when applying uncertainty cooldowns", () => {
    for (const answer of ["skip", "not_sure"] as const) {
      const own = uncertain("gross_motor.gallops", answer, fresh);
      for (const foreign of [
        {...own, childId: "sibling"},
        {...own, familyId: "other-family"},
        {...own, childId: undefined, familyId: undefined} as unknown as ProgressSelectionAnswer,
      ]) {
        assert.equal(selectedId(select([], {selectionAnswers: [foreign]})), "gross_motor.gallops");
      }
      assert.notEqual(selectedId(select([], {selectionAnswers: [own]})), "gross_motor.gallops");
    }
  });

  it("never fills a bounded region with unrelated outside questions", () => {
    const next = select([evidence("gross_motor.gallops", "easily"), evidence("gross_motor.one-foot-hop", "not_yet")]);
    assert.deepEqual(next, {kind: "stop", reason: "bank_coverage_end", mixedEvidence: false});
  });

  it("reports the bank ceiling, never a ceiling on the child", () => {
    assert.equal(selectedId(select([evidence("gross_motor.own-fitness", "easily")])), "bank_coverage_end");
  });

  it("keeps crossed current evidence mixed instead of averaging", () => {
    const next = select([evidence("gross_motor.catches-ball", "easily"), evidence("gross_motor.gallops", "not_yet")]);
    assert.deepEqual(next, {kind: "stop", reason: "no_useful_question", mixedEvidence: true});
  });

  it("refreshes a stale crossed controlling answer before concluding", () => {
    assert.equal(selectedId(select([evidence("gross_motor.catches-ball", "easily"), evidence("gross_motor.gallops", "not_yet", old)])), "gross_motor.gallops");
  });

  it("stops at exactly eight accepted responses", () => {
    const sittingItemIds = getMapSubject("gross_motor")!.items.slice(0, 8).map(item => item.id);
    assert.equal(selectedId(select([], {sittingItemIds})), "sitting_limit");
  });

  it("rejects foreign evidence instead of using it to select", () => {
    const foreign = {...evidence("gross_motor.catches-ball", "easily"), familyId: "other"};
    assert.throws(() => select([foreign]));
  });

  it("preserves the existing bundled-question exclusions", () => {
    for (const subjectId of ["math", "literacy"]) {
      const subject = getMapSubject(subjectId)!;
      for (const item of subject.items) {
        const next = select([], {subjectId, ageMonths: item.typicalMonths});
        assert.ok(!["math.skip-counting", "literacy.reads-short-book", "literacy.chapter-books"].includes(selectedId(next)));
      }
    }
  });
});
