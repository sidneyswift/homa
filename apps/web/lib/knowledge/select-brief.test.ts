import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  rankBriefKnowledge,
  selectBriefKnowledge,
  type BriefKnowledgeRow,
  type BriefSelectionInput,
} from "./select-brief";

const NOW = new Date("2026-07-16T12:00:00.000Z");
const INPUT: BriefSelectionInput = {
  familyId: "family-a",
  localDate: "2026-07-16",
  now: NOW,
  stages: ["early_elem"],
  subjectKeys: ["math"],
  frontierDomains: ["fractions"],
  methodKeys: ["montessori"],
  recentUses: [],
};

function row(overrides: Partial<BriefKnowledgeRow> = {}): BriefKnowledgeRow {
  return {
    id: "row-a",
    topicType: "subject",
    topicKey: "math",
    lens: "how_to_teach",
    stage: "early_elem",
    title: "Teaching math facts",
    summary: "Short, spaced practice supports retrieval without replacing conceptual work.",
    confidence: "high",
    sourceTier: 1,
    citations: [{ url: "https://eric.ed.gov/?id=1", claim: "Spacing supports retention." }],
    lastVerifiedAt: NOW.toISOString(),
    freshnessTtlDays: 90,
    recentDeliveredUseCount: 0,
    ...overrides,
  };
}

describe("rankBriefKnowledge", () => {
  it("prefers an exact frontier over a subject match", () => {
    assert.equal(
      selectBriefKnowledge([row(), row({ id: "frontier", topicKey: "fractions" })], INPUT)?.id,
      "frontier",
    );
  });

  it("excludes a current study with no stage", () => {
    assert.equal(
      selectBriefKnowledge([row({ lens: "current_study", stage: null })], INPUT),
      null,
    );
  });

  it("requires a current-study source tier from one through three", () => {
    assert.equal(
      selectBriefKnowledge([row({ lens: "current_study", sourceTier: 4 })], INPUT),
      null,
    );
  });

  it("requires a matching non-method stage", () => {
    assert.equal(selectBriefKnowledge([row({ stage: "early_years" })], INPUT), null);
  });

  it("allows a stage-null method row", () => {
    assert.equal(
      selectBriefKnowledge([row({ lens: "method", topicType: "method_philosophy", topicKey: "montessori", stage: null })], INPUT)?.fit,
      "method",
    );
  });

  it("uses the stored TTL boundary", () => {
    assert.equal(
      selectBriefKnowledge([row({ freshnessTtlDays: 1, lastVerifiedAt: "2026-07-15T11:59:59.999Z" })], INPUT),
      null,
    );
  });

  it("excludes low-confidence or unnamed rows", () => {
    assert.equal(selectBriefKnowledge([row({ confidence: "low" })], INPUT), null);
    assert.equal(
      selectBriefKnowledge([row({ citations: [{ url: "https://example.test", claim: "A claim." }] })], INPUT),
      null,
    );
  });

  it("uses timestamped fourteen-day cooldown, with exactly fourteen days eligible", () => {
    assert.equal(
      selectBriefKnowledge([row()], { ...INPUT, recentUses: [{ knowledgeId: "row-a", usedAt: "2026-07-02T12:00:00.001Z" }] }),
      null,
    );
    assert.equal(
      selectBriefKnowledge([row()], { ...INPUT, recentUses: [{ knowledgeId: "row-a", usedAt: "2026-07-02T12:00:00.000Z" }] })?.id,
      "row-a",
    );
  });

  it("ranks fewer recent fleet deliveries before the tie breaker", () => {
    assert.equal(
      rankBriefKnowledge([row({ id: "used", recentDeliveredUseCount: 5 }), row({ id: "fresh", recentDeliveredUseCount: 1 })], INPUT)[0]?.id,
      "fresh",
    );
  });

  it("derives the legacy broad-subject fallback last", () => {
    const candidates = rankBriefKnowledge(
      [row({ id: "broad", stage: null }), row({ id: "specific", stage: "early_elem" })],
      INPUT,
    );
    assert.deepEqual(candidates.map((candidate) => candidate.id), ["specific", "broad"]);
    assert.equal(candidates[1]?.fit, "broad_subject");
  });
});
