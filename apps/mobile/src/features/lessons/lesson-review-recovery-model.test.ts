import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lessonReviewRecoveryCopy,
  selectLessonReviewRecovery,
  type TrackedLessonReviewStatus,
} from "./lesson-review-recovery-model";

function item(
  lessonId: string,
  outcome: TrackedLessonReviewStatus["outcome"],
  savedAt = "2026-08-02T12:00:00.000Z",
): TrackedLessonReviewStatus {
  return {
    lesson: {
      lessonId,
      childId: "11111111-1111-4111-8111-111111111111",
      childName: "Maya",
      purpose: "reading lesson",
      savedAt,
    },
    outcome,
  };
}

describe("native lesson review recovery model", () => {
  it("surfaces action-needed reviews before ordinary processing", () => {
    const processing = item(
      "22222222-2222-4222-8222-222222222222",
      { status: "processing" },
    );
    const retryable = item(
      "33333333-3333-4333-8333-333333333333",
      { status: "review_failed", retryable: true, reason: "retryable" },
    );
    assert.equal(
      selectLessonReviewRecovery([processing, retryable], new Map()),
      retryable,
    );
  });

  it("hides only the deferred state and resurfaces a later transition", () => {
    const ready = item(
      "44444444-4444-4444-8444-444444444444",
      {
        status: "ready",
        review: { summary: "Maya decoded the new words.", evidenceCount: 1, observationCount: 1 },
      },
    );
    assert.equal(
      selectLessonReviewRecovery(
        [ready],
        new Map([[ready.lesson.lessonId, "ready"]]),
      ),
      null,
    );
    const processing = { ...ready, outcome: { status: "processing" } as const };
    assert.equal(
      selectLessonReviewRecovery(
        [processing],
        new Map([[ready.lesson.lessonId, "ready"]]),
      ),
      null,
    );
    const retryable = {
      ...ready,
      outcome: { status: "review_failed", retryable: true, reason: "retryable" } as const,
    };
    assert.equal(
      selectLessonReviewRecovery(
        [retryable],
        new Map([[ready.lesson.lessonId, "ready"]]),
      ),
      retryable,
    );
  });

  it("polls passive processing and temporary lookup failures without interrupting Voice", () => {
    const processing = item(
      "88888888-8888-4888-8888-888888888888",
      { status: "processing" },
    );
    const temporary = item(
      "99999999-9999-4999-8999-999999999999",
      { status: "status_unavailable", reason: "temporary" },
    );
    assert.equal(selectLessonReviewRecovery([processing, temporary], new Map()), null);
  });

  it("keeps actions truthful for ready, retryable, and terminal states", () => {
    const ready = item(
      "55555555-5555-4555-8555-555555555555",
      {
        status: "ready",
        review: { summary: "A clear breakthrough.", evidenceCount: 1, observationCount: 0 },
      },
    );
    const retryable = item(
      "66666666-6666-4666-8666-666666666666",
      { status: "review_failed", retryable: true, reason: "retryable" },
    );
    const terminal = item(
      "77777777-7777-4777-8777-777777777777",
      { status: "review_failed", retryable: false, reason: "attempts_exhausted" },
    );
    assert.deepEqual(
      [lessonReviewRecoveryCopy(ready).primary, lessonReviewRecoveryCopy(retryable).primary],
      ["discuss", "retry"],
    );
    assert.deepEqual(
      [lessonReviewRecoveryCopy(terminal).primary, lessonReviewRecoveryCopy(terminal).secondary],
      ["discuss", "dismiss"],
    );
    assert.doesNotMatch(
      lessonReviewRecoveryCopy(terminal).body,
      /raw audio|transcript left|safe pass|upload/iu,
    );
    assert.match(lessonReviewRecoveryCopy(terminal).body, /does not need to record/iu);
  });
});
