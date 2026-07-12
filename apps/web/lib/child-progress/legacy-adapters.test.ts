import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createLegacyProgressAdapters,
  legacyProgressTransportIdempotencyKey,
  type LegacyProgressAdapterDependencies,
} from "./legacy-adapters";

const FAMILY_ID = "family-1";
const CHILD_ID = "child-1";
const ITEM_ID = "math.counts-to-5";
const OBSERVED_AT = "2026-07-12T08:00:00.000Z";

function createDependencies(input: {
  enabled: boolean;
}): {
  dependencies: LegacyProgressAdapterDependencies;
  calls: {
    legacyAnswers: number;
    legacyDeletes: number;
    legacyCorrections: number;
    walkCoverageAnswers: number;
    walkCoverageInput: unknown;
    childProgressAnswers: number;
    childProgressInput: unknown;
    childProgressCorrectionInput: unknown;
  };
} {
  const calls = {
    legacyAnswers: 0,
    legacyDeletes: 0,
    legacyCorrections: 0,
    walkCoverageAnswers: 0,
    walkCoverageInput: undefined as unknown,
    childProgressAnswers: 0,
    childProgressInput: undefined as unknown,
    childProgressCorrectionInput: undefined as unknown,
  };
  return {
    dependencies: {
      liveProgressEnabled: () => input.enabled,
      isKnownAnswerItem: () => true,
      isKnownWalkAssessmentTopic: () => true,
      async saveLegacyAnswer() {
        calls.legacyAnswers += 1;
        return true;
      },
      async deleteLegacyAnswer() {
        calls.legacyDeletes += 1;
        return true;
      },
      async correctLegacyAnswers() {
        calls.legacyCorrections += 1;
        return true;
      },
      async saveWalkCoverageAnswer(walkInput) {
        calls.walkCoverageAnswers += 1;
        calls.walkCoverageInput = walkInput;
        return true;
      },
      async recordChildProgressEvidence(progressInput) {
        calls.childProgressAnswers += 1;
        calls.childProgressInput = progressInput;
        return { status: "recorded" };
      },
      async correctChildProgressAnswers(correctionInput) {
        calls.childProgressAnswers += 1;
        calls.childProgressCorrectionInput = correctionInput;
        return { status: "answers_corrected" };
      },
    },
    calls,
  };
}

describe("legacy progress adapters", () => {
  it("derives SMS retries from trusted provider identity", () => {
    const first = legacyProgressTransportIdempotencyKey({
      operation: "signup-answer",
      channel: "sms",
      providerMessageId: "provider-message-1",
      runtimeSessionId: "runtime-a",
      turnId: "turn-a",
    });
    const retry = legacyProgressTransportIdempotencyKey({
      operation: "signup-answer",
      channel: "sms",
      providerMessageId: "provider-message-1",
      runtimeSessionId: "runtime-b",
      turnId: "turn-b",
    });
    const nextMessage = legacyProgressTransportIdempotencyKey({
      operation: "signup-answer",
      channel: "sms",
      providerMessageId: "provider-message-2",
      runtimeSessionId: "runtime-a",
      turnId: "turn-a",
    });

    assert.equal(retry, first);
    assert.notEqual(nextMessage, first);
  });

  it("uses only the existing checklist writer while the flag is off", async () => {
    const { dependencies, calls } = createDependencies({
      enabled: false,
    });
    const adapters = createLegacyProgressAdapters(dependencies);

    const result = await adapters.saveAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: ITEM_ID,
      answer: "easily",
      source: "checklist",
      memberUserId: null,
      observedAt: OBSERVED_AT,
      idempotencyKey: "answer-attempt-1",
    });

    assert.deepEqual(result, {
      status: "saved",
      mode: "legacy",
    });
    assert.equal(calls.legacyAnswers, 1);
    assert.equal(calls.childProgressAnswers, 0);
  });

  it("records an evidence answer only through ChildProgress when enabled", async () => {
    const { dependencies, calls } = createDependencies({
      enabled: true,
    });
    const adapters = createLegacyProgressAdapters(dependencies);
    const input = {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: ITEM_ID,
      answer: "getting_there" as const,
      source: "deep_dive" as const,
      memberUserId: "adult-1",
      observedAt: OBSERVED_AT,
      idempotencyKey: "answer-attempt-2",
    };

    const result = await adapters.saveAnswer(input);

    assert.deepEqual(result, {
      status: "saved",
      mode: "child_progress",
    });
    assert.equal(calls.legacyAnswers, 0);
    assert.equal(calls.childProgressAnswers, 1);
    assert.deepEqual(calls.childProgressInput, input);
  });

  it("treats an exact ChildProgress replay as the same saved answer", async () => {
    const { dependencies, calls } = createDependencies({
      enabled: true,
    });
    dependencies.recordChildProgressEvidence = async () => {
      calls.childProgressAnswers += 1;
      return {
        status: "duplicate",
        original: { status: "recorded" },
      };
    };
    const adapters = createLegacyProgressAdapters(dependencies);

    const result = await adapters.saveAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: ITEM_ID,
      answer: "easily",
      source: "checklist",
      memberUserId: null,
      observedAt: "2026-07-12T08:00:01.000Z",
      idempotencyKey: "answer-attempt-retry",
    });

    assert.deepEqual(result, {
      status: "saved",
      mode: "child_progress",
    });
    assert.equal(calls.legacyAnswers, 0);
    assert.equal(calls.childProgressAnswers, 1);
  });

  it("keeps not-sure and skip as coverage without creating evidence", async () => {
    for (const answer of ["not_sure", "skip"] as const) {
      const { dependencies, calls } = createDependencies({
        enabled: true,
      });
      const adapters = createLegacyProgressAdapters(dependencies);

      const result = await adapters.saveAnswer({
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        itemId: ITEM_ID,
        answer,
        source: "checklist",
        memberUserId: null,
        observedAt: OBSERVED_AT,
        idempotencyKey: `answer-${answer}`,
      });

      assert.deepEqual(result, {
        status: "saved",
        mode: "child_progress",
      });
      assert.equal(calls.legacyAnswers, 0);
      assert.equal(calls.childProgressAnswers, 1);
      assert.deepEqual(calls.childProgressCorrectionInput, {
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        changes: [{ itemId: ITEM_ID, answer }],
        source: "checklist",
        memberUserId: null,
        observedAt: OBSERVED_AT,
        idempotencyKey: `answer-${answer}`,
      });
    }
  });

  it("routes all five taxonomy walk answers through their correct flag-on path", async () => {
    const topicId = "math.comparing-groups-more-or-fewer";
    for (const answer of [
      "easily",
      "getting_there",
      "not_yet",
      "not_sure",
      "skip",
    ] as const) {
      const { dependencies, calls } = createDependencies({
        enabled: true,
      });
      const adapters = createLegacyProgressAdapters(dependencies);
      const input = {
        familyId: FAMILY_ID,
        childId: CHILD_ID,
        itemId: topicId,
        answer,
        source: "onboarding_walk" as const,
        memberUserId: null,
        observedAt: OBSERVED_AT,
        idempotencyKey: `walk-${answer}`,
      };

      const result = await adapters.saveAnswer(input);

      assert.deepEqual(result, {
        status: "saved",
        mode: "child_progress",
      });
      if (answer === "not_sure" || answer === "skip") {
        assert.equal(calls.walkCoverageAnswers, 1);
        assert.deepEqual(calls.walkCoverageInput, input);
        assert.equal(calls.childProgressAnswers, 0);
      } else {
        assert.equal(calls.walkCoverageAnswers, 0);
        assert.equal(calls.childProgressAnswers, 1);
        assert.deepEqual(calls.childProgressInput, input);
      }
    }
  });

  it("rejects walk coverage outside assessment taxonomy metadata", async () => {
    const { dependencies, calls } = createDependencies({
      enabled: true,
    });
    dependencies.isKnownWalkAssessmentTopic = () => false;
    const adapters = createLegacyProgressAdapters(dependencies);

    const result = await adapters.saveAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: "math.content-only-topic",
      answer: "skip",
      source: "onboarding_walk",
      memberUserId: null,
      observedAt: OBSERVED_AT,
      idempotencyKey: "walk-invalid-coverage",
    });

    assert.deepEqual(result, {
      status: "unknown_child_or_item",
    });
    assert.equal(calls.walkCoverageAnswers, 0);
    assert.equal(calls.childProgressAnswers, 0);
  });

  it("keeps delete and batch correction entirely legacy while disabled", async () => {
    const { dependencies, calls } = createDependencies({
      enabled: false,
    });
    const adapters = createLegacyProgressAdapters(dependencies);

    const deleted = await adapters.deleteAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: ITEM_ID,
      memberUserId: null,
      observedAt: OBSERVED_AT,
      idempotencyKey: "delete-attempt-1",
    });
    const corrected = await adapters.correctAnswers({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      changes: [{ itemId: ITEM_ID, answer: "not_yet" }],
      source: "report_correction",
      memberUserId: null,
      observedAt: OBSERVED_AT,
      idempotencyKey: "correction-attempt-1",
    });

    assert.deepEqual(deleted, {
      status: "saved",
      mode: "legacy",
    });
    assert.deepEqual(corrected, {
      status: "saved",
      mode: "legacy",
    });
    assert.equal(calls.legacyDeletes, 1);
    assert.equal(calls.legacyCorrections, 1);
    assert.equal(calls.childProgressAnswers, 0);
  });

  it("keeps walk and conversation writers outside ChildProgress while disabled", async () => {
    const { dependencies, calls } = createDependencies({
      enabled: false,
    });
    const adapters = createLegacyProgressAdapters(dependencies);

    const walk = await adapters.saveAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: "math.comparing-groups-more-or-fewer",
      answer: "easily",
      source: "onboarding_walk",
      memberUserId: null,
      observedAt: OBSERVED_AT,
      idempotencyKey: "walk-disabled",
    });
    const conversation = await adapters.saveAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: ITEM_ID,
      answer: "not_yet",
      source: "conversation",
      memberUserId: "adult-1",
      observedAt: OBSERVED_AT,
      idempotencyKey: "conversation-disabled",
    });

    assert.equal(walk.status, "saved");
    assert.equal(conversation.status, "saved");
    assert.equal(calls.legacyAnswers, 1);
    assert.equal(calls.legacyCorrections, 1);
    assert.equal(calls.childProgressAnswers, 0);
  });

  it("routes enabled deletes and report corrections through atomic ChildProgress batches", async () => {
    const { dependencies, calls } = createDependencies({
      enabled: true,
    });
    const adapters = createLegacyProgressAdapters(dependencies);

    const deleted = await adapters.deleteAnswer({
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      itemId: ITEM_ID,
      memberUserId: "adult-1",
      observedAt: OBSERVED_AT,
      idempotencyKey: "delete-attempt-2",
    });
    assert.deepEqual(deleted, {
      status: "saved",
      mode: "child_progress",
    });
    assert.deepEqual(calls.childProgressCorrectionInput, {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      changes: [{ itemId: ITEM_ID, answer: null }],
      source: "correction",
      memberUserId: "adult-1",
      observedAt: OBSERVED_AT,
      idempotencyKey: "delete-attempt-2",
    });

    const correctionInput = {
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      changes: [
        { itemId: ITEM_ID, answer: "not_yet" as const },
        { itemId: "math.counts-to-10", answer: "not_sure" as const },
      ],
      source: "report_correction" as const,
      memberUserId: "adult-1",
      observedAt: OBSERVED_AT,
      idempotencyKey: "correction-attempt-2",
    };
    const corrected = await adapters.correctAnswers(correctionInput);

    assert.deepEqual(corrected, {
      status: "saved",
      mode: "child_progress",
    });
    assert.deepEqual(
      calls.childProgressCorrectionInput,
      correctionInput,
    );
    assert.equal(calls.legacyDeletes, 0);
    assert.equal(calls.legacyCorrections, 0);
    assert.equal(calls.childProgressAnswers, 2);
  });
});
