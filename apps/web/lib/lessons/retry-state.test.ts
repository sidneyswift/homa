import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasUsableLessonTranscript,
  lessonAnalysisRetryState,
  lessonRetryApiReason,
  type LessonAnalysisRetryFacts,
} from "./retry-state";

function facts(
  overrides: Partial<LessonAnalysisRetryFacts> = {},
): LessonAnalysisRetryFacts {
  return {
    status: "failed",
    attempts: 1,
    maxAttempts: 4,
    audioDeletedAt: null,
    hasUsableTranscript: false,
    ...overrides,
  };
}

describe("recorded lesson retry state", () => {
  it("allows attempt one to become two and attempt three to become four", () => {
    assert.deepEqual(lessonAnalysisRetryState(facts({ attempts: 1 })), {
      status: "available",
      attempts: 1,
    });
    assert.deepEqual(lessonAnalysisRetryState(facts({ attempts: 3 })), {
      status: "available",
      attempts: 3,
    });
  });

  it("keeps attempt four terminal", () => {
    const state = lessonAnalysisRetryState(facts({ attempts: 4 }));
    assert.deepEqual(state, { status: "exhausted", attempts: 4 });
    assert.equal(lessonRetryApiReason(state), "attempts-exhausted");
  });

  it("refuses deleted audio only when no usable transcript remains", () => {
    const unavailable = lessonAnalysisRetryState(
      facts({ audioDeletedAt: "2026-08-02T12:00:00Z" }),
    );
    assert.deepEqual(unavailable, {
      status: "source_unavailable",
      attempts: 1,
    });
    assert.equal(lessonRetryApiReason(unavailable), "source-unavailable");
    assert.equal(
      lessonAnalysisRetryState(
        facts({
          audioDeletedAt: "2026-08-02T12:00:00Z",
          hasUsableTranscript: true,
        }),
      ).status,
      "available",
    );
    assert.equal(hasUsableLessonTranscript([null, "  ", "A real sentence"]), true);
    assert.equal(hasUsableLessonTranscript([null, "  "]), false);
  });

  it("keeps recording, processing, and ready states distinct", () => {
    assert.equal(
      lessonAnalysisRetryState(facts({ status: "recording" })).status,
      "not_finished",
    );
    assert.equal(
      lessonAnalysisRetryState(facts({ status: "uploaded" })).status,
      "processing",
    );
    assert.equal(
      lessonAnalysisRetryState(facts({ status: "analyzing" })).status,
      "processing",
    );
    assert.equal(
      lessonAnalysisRetryState(facts({ status: "ready" })).status,
      "ready",
    );
  });
});
