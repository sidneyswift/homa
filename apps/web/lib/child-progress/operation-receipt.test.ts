import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { storedChildProgressOperationResultSchema } from "./operation-receipt";

const historicalEvidence = {
  id: "evidence-1",
  childId: "child-1",
  familyId: "family-1",
  itemId: "math.counts-to-5",
  answer: "easily",
  source: "journal",
  memberUserId: "adult-1",
  adultDisplayName: "Elena",
  quote: "Maya counted five shells.",
  channel: "web",
  messageId: "00000000-0000-4000-8000-000000000001",
  checkInId: null,
  supersedesId: null,
  supersededAt: null,
  observedAt: "2026-07-11T17:30:00.000000Z",
  createdAt: "2026-07-11T17:30:01.000000Z",
};

describe("Progress operation receipt provenance compatibility", () => {
  it("hydrates a pre-provenance receipt as unknown", () => {
    const parsed = storedChildProgressOperationResultSchema.parse({
      status: "recorded",
      evidence: [historicalEvidence],
      affectedItemIds: [historicalEvidence.itemId],
      conflictIds: [],
    });

    assert.equal(parsed.status, "recorded");
    if (parsed.status === "recorded") {
      assert.equal(parsed.evidence[0].derivation, "unknown");
    }
  });

  it("retains a new derivation and rejects an invented value", () => {
    const common = {
      status: "recorded",
      affectedItemIds: [historicalEvidence.itemId],
      conflictIds: [],
    } as const;
    const parsed = storedChildProgressOperationResultSchema.parse({
      ...common,
      evidence: [{ ...historicalEvidence, derivation: "inferred" }],
    });
    assert.equal(parsed.status, "recorded");
    if (parsed.status === "recorded") {
      assert.equal(parsed.evidence[0].derivation, "inferred");
    }
    assert.throws(() =>
      storedChildProgressOperationResultSchema.parse({
        ...common,
        evidence: [{ ...historicalEvidence, derivation: "certain" }],
      })
    );
  });
});
