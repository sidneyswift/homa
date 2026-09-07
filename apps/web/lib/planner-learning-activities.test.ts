import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findLoggedActivityCandidates,
  plannerLearningIdempotencyKey,
  plannerLearningMutationUuid,
  verifyPlannerSourceQuote,
} from "./planner-learning-activities";
import { hoursCaptureDisplayFields, hoursCaptureInputSchema, hoursCaptureKey, hoursCaptureResultSchema } from "./hours-capture";
import { learningMutationUuid, learningOperationFailure } from "./learning-write-operations";
import { plannerLearningToolContext } from "./planner-learning-tool-context";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";

describe("Planner learning provenance", () => {
  it("accepts only an exact span from the trusted current message", () => {
    assert.equal(
      verifyPlannerSourceQuote({
        canonicalInboundText: "We did Horizons lesson 42 with Maya today.",
        sourceQuote: "Horizons lesson 42 with Maya",
      }),
      "Horizons lesson 42 with Maya",
    );
    assert.throws(
      () => verifyPlannerSourceQuote({
        canonicalInboundText: "We did Horizons lesson 42 with Maya today.",
        sourceQuote: "Maya completed math lesson 42",
      }),
      /exact span/u,
    );
  });

  it("derives stable replay identity while keeping distinct lessons separate", () => {
    const first = plannerLearningIdempotencyKey({
      action: "record",
      sourceMessageId: MESSAGE_ID,
      identity: [1],
    });
    assert.equal(
      first,
      plannerLearningIdempotencyKey({
        action: "record",
        sourceMessageId: MESSAGE_ID,
        identity: [1],
      }),
    );
    assert.notEqual(
      first,
      plannerLearningIdempotencyKey({
        action: "record",
        sourceMessageId: MESSAGE_ID,
        identity: [2],
      }),
    );
  });

  it("derives stable row ids while keeping mutation slots distinct", () => {
    const seed = "planner-learning:record:" + "a".repeat(64);
    const activityId = plannerLearningMutationUuid(seed, "activity");
    assert.equal(activityId, plannerLearningMutationUuid(seed, "activity"));
    assert.notEqual(activityId, plannerLearningMutationUuid(seed, "hours:0"));
    assert.match(
      activityId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it("takes message identity and Voice modality only from trusted attributes", () => {
    assert.deepEqual(
      plannerLearningToolContext({
        canonicalInboundText: "We finished piano.",
        canonicalInboundMessageId: MESSAGE_ID,
        channel: "mobile",
        messageModality: "voice",
      }),
      {
        canonicalInboundText: "We finished piano.",
        sourceMessageId: MESSAGE_ID,
        sourceChannel: "voice",
      },
    );
    assert.equal(
      plannerLearningToolContext({ canonicalInboundText: "Unidentified" }),
      null,
    );
  });
});

describe("findLoggedActivityCandidates", () => {
  it("short-circuits on an empty child list without touching the database", async () => {
    // No familyId/mapDb credentials are configured in this unit test
    // process; reaching the query at all would throw. childIds.length
    // === 0 is record_planner_activity's own skip condition (a
    // whole-family log), so the guard must return before that query.
    const candidates = await findLoggedActivityCandidates({
      familyId: "11111111-1111-4111-8111-111111111111",
      childIds: [],
      subject: "math",
      activityDate: "2026-08-26",
      excludeActivityId: "22222222-2222-4222-8222-222222222222",
    });
    assert.deepEqual(candidates, []);
  });
});


describe("Hours capture identity boundaries", () => {
  it("requires a bounded activity ordinal, exact identity and real calendar date", () => {
    const input = { familyId: MESSAGE_ID, sourceMessageId: MESSAGE_ID, sourceActivityOrdinal: 1,
      sourceQuote: "reading", subject: "reading", minutes: 30, source: "chat" };
    assert.equal(hoursCaptureInputSchema.safeParse(input).success, true);
    for (const delta of [{ sourceActivityOrdinal: 0 }, { sourceActivityOrdinal: 33 }, { sourceActivityOrdinal: 1.5 },
      { sourceMessageId: "unknown" }, { sourceQuote: "" }, { minutes: 30.5 }, { happenedOn: "2026-02-29" }]) {
      assert.equal(hoursCaptureInputSchema.safeParse({ ...input, ...delta }).success, false);
    }
  });
  it("normalizes UUID representation and preserves deterministic effect slots", () => {
    const id = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
    assert.equal(hoursCaptureKey(id, 1), hoursCaptureKey(id.toUpperCase(), 1));
    assert.notEqual(hoursCaptureKey(id, 1), hoursCaptureKey(id, 2));
    assert.equal(learningMutationUuid("source", "hours"), plannerLearningMutationUuid("source", "hours"));
    assert.notEqual(learningMutationUuid("source", "hours"), learningMutationUuid("source", "operation"));
  });
  it("rejects impossible success receipts and identifies an immutable conflict explicitly", () => {
    assert.equal(hoursCaptureResultSchema.safeParse({ logged: true, inserted: false, status: "recorded",
      resolvedDate: "2026-09-06", entry: null }).success, false);
    assert.equal(learningOperationFailure({ code: "P1090" })?.conflict, true);
    assert.equal(learningOperationFailure({ code: "23505" })?.conflict, true);
    assert.equal(learningOperationFailure({ code: "42501" })?.conflict, false);
    assert.equal(learningOperationFailure(new Error("unrelated")), null);
  });
});


describe("Hours receipt display compatibility", () => {
  it("uses current saved details and omits removed entry details", () => {
    const current = { id: MESSAGE_ID, childId: null, subject: "science" as const, minutes: 17,
      happenedOn: "2026-09-06", source: "chat" as const, note: "Edited", customLabel: null };
    assert.deepEqual(hoursCaptureDisplayFields({ logged: true, inserted: false, status: "recorded",
      resolvedDate: "2026-09-06", entry: current }), { done: true, entryId: MESSAGE_ID, subject: "science", minutes: 17 });
    assert.deepEqual(hoursCaptureDisplayFields({ logged: false, inserted: false, status: "removed",
      resolvedDate: "2026-09-06", entry: null }), { done: false, entryId: undefined, subject: undefined, minutes: undefined });
  });
});
