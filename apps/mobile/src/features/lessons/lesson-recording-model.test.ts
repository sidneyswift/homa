import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveLessonRecordingSignals,
  formatLessonElapsed,
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
    assert.match(recorderPhaseCopy("ready", "Mia"), /review is ready/u);
  });

  it("renders an elapsed lesson clock", () => {
    assert.equal(formatLessonElapsed(0), "00:00");
    assert.equal(formatLessonElapsed(125), "02:05");
  });
});
