import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  plannerLearningIdempotencyKey,
  plannerLearningMutationUuid,
  verifyPlannerSourceQuote,
} from "./planner-learning-activities";
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
      identity: ["Horizons lesson 42", "math", "2026-08-02"],
    });
    assert.equal(
      first,
      plannerLearningIdempotencyKey({
        action: "record",
        sourceMessageId: MESSAGE_ID,
        identity: ["Horizons lesson 42", "math", "2026-08-02"],
      }),
    );
    assert.notEqual(
      first,
      plannerLearningIdempotencyKey({
        action: "record",
        sourceMessageId: MESSAGE_ID,
        identity: ["Horizons lesson 43", "math", "2026-08-02"],
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
