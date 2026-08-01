import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const recorderSource = readFileSync(
  new URL("./native-lesson-recorder.tsx", import.meta.url),
  "utf8",
);
const voiceScreenSource = readFileSync(
  new URL("../voice/voice-screen.tsx", import.meta.url),
  "utf8",
);
const voiceSessionSource = readFileSync(
  new URL("../voice/use-voice-session.ts", import.meta.url),
  "utf8",
);

/**
 * These wiring checks cover boundaries that are easy to regress without a
 * device. Actual capture, playback, and interruption behavior still require
 * the physical-device acceptance test tracked by the issue.
 */
describe("native lesson recorder safety contract", () => {
  it("releases Voice microphone ownership before showing the recorder", () => {
    const suspendIndex = voiceScreenSource.indexOf("suspendVoice();");
    const showRecorderIndex = voiceScreenSource.indexOf(
      "setActiveLessonRecorder(pendingLesson);",
    );

    assert.notEqual(suspendIndex, -1);
    assert.notEqual(showRecorderIndex, -1);
    assert.ok(suspendIndex < showRecorderIndex);
  });

  it("starts only from the explicit local-test button", () => {
    assert.match(
      recorderSource,
      /label="Test recording on this phone" onPress=\{\(\) => void startCapture\(\)\}/u,
    );
    assert.match(recorderSource, /requestRecordingPermissionsAsync\(\)/u);
    assert.match(recorderSource, /allowsBackgroundRecording: false/u);
    assert.match(recorderSource, /AppState\.addEventListener/u);
    assert.match(recorderSource, /recorder\.pause\(\)/u);
  });

  it("keeps prototype audio local and deletes it before Voice resumes", () => {
    assert.doesNotMatch(recorderSource, /fetch\(|upload\(|createUpload/u);
    const deleteIndex = recorderSource.indexOf("if (file.exists) file.delete();");
    const resumeIndex = recorderSource.indexOf("onResumeVoice();");

    assert.notEqual(deleteIndex, -1);
    assert.notEqual(resumeIndex, -1);
    assert.ok(deleteIndex < resumeIndex);
  });

  it("resumes the existing Voice context instead of starting a new conversation", () => {
    assert.match(voiceSessionSource, /const resume = useCallback\(\(\) => connect\(false\)/u);
    assert.match(voiceSessionSource, /if \(resetConversation\) \{/u);
  });
});
