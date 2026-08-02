import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveLessonRecordingSignals,
  formatLessonElapsed,
  lessonReviewFailureCopy,
  parseNativeLessonReviewOutcome,
  parsePreparedLessonRecording,
  recorderPhaseCopy,
} from "./lesson-recording-model";

describe("native lesson recording handoff", () => {
  it("accepts only the successful typed tool result", () => {
    const prepared = parsePreparedLessonRecording({
      prepared: true,
      nativeAction: "lesson_recording",
      childId: "11111111-1111-4111-8111-111111111111",
      childName: "Mia",
      purpose: "reading lesson",
    });
    assert.deepEqual(prepared, {
      childId: "11111111-1111-4111-8111-111111111111",
      childName: "Mia",
      purpose: "reading lesson",
    });
  });

  it("does not arm from prose or an unsuccessful tool result", () => {
    assert.equal(parsePreparedLessonRecording("start recording"), null);
    assert.equal(
      parsePreparedLessonRecording({
        prepared: false,
        nativeAction: "lesson_recording",
        childId: "child",
        childName: "Mia",
        purpose: "reading",
      }),
      null,
    );
  });

  it("derives one new signal and does not replay a handled handoff", () => {
    const messages = [{
      id: "m1",
      role: "assistant",
      parts: [{
        type: "dynamic-tool",
        toolName: "prepare_lesson_recording",
        state: "output-available",
        output: {
          prepared: true,
          nativeAction: "lesson_recording",
          childId: "11111111-1111-4111-8111-111111111111",
          childName: "Mia",
          purpose: "reading lesson",
        },
      }],
    }];
    const first = deriveLessonRecordingSignals(messages, new Set());
    assert.equal(first.signals.length, 1);
    assert.deepEqual(first.keys, ["m1:0"]);
    assert.equal(
      deriveLessonRecordingSignals(messages, new Set(["m1:0"])).signals.length,
      0,
    );
  });

  it("names capture and persistence truthfully", () => {
    assert.match(recorderPhaseCopy("confirm", "Mia"), /Nothing is recording yet/u);
    assert.match(recorderPhaseCopy("paused", "Mia"), /Nothing new is being captured/u);
    assert.match(recorderPhaseCopy("review", "Mia"), /save it privately/u);
    assert.match(recorderPhaseCopy("processing", "Mia"), /still finishing/u);
    assert.doesNotMatch(recorderPhaseCopy("processing", "Mia"), /review is ready/u);
    assert.match(recorderPhaseCopy("review_failed", "Mia"), /couldn't finish/u);
    assert.doesNotMatch(recorderPhaseCopy("review_failed", "Mia"), /keeps working/u);
    assert.match(recorderPhaseCopy("ready", "Mia"), /review is ready/u);
  });

  it("renders an elapsed lesson clock", () => {
    assert.equal(formatLessonElapsed(0), "00:00");
    assert.equal(formatLessonElapsed(125), "02:05");
  });

  it("parses server-owned retryability and terminal reasons", () => {
    assert.deepEqual(
      parseNativeLessonReviewOutcome({
        status: "failed",
        retryable: true,
        retryReason: null,
      }),
      { status: "review_failed", retryable: true, reason: "retryable" },
    );
    assert.deepEqual(
      parseNativeLessonReviewOutcome({
        status: "review_failed",
        retryable: false,
        reason: "attempts-exhausted",
      }),
      {
        status: "review_failed",
        retryable: false,
        reason: "attempts_exhausted",
      },
    );
    assert.deepEqual(
      parseNativeLessonReviewOutcome({
        status: "failed",
        retryable: false,
        retryReason: "source-unavailable",
      }),
      {
        status: "review_failed",
        retryable: false,
        reason: "source_unavailable",
      },
    );
  });

  it("gives retryable and terminal review failures distinct copy", () => {
    assert.match(lessonReviewFailureCopy("retryable"), /listen again/u);
    assert.match(lessonReviewFailureCopy("attempts_exhausted"), /every safe pass/u);
    assert.match(lessonReviewFailureCopy("source_unavailable"), /no longer available/u);
  });
});
