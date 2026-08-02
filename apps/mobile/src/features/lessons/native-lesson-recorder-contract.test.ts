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
    const suspendIndex = voiceScreenSource.indexOf(
      'pauseForMicrophoneOwner("Lesson recording has the microphone.");',
    );
    const showRecorderIndex = voiceScreenSource.indexOf(
      "setActiveLessonRecorder(pendingLesson);",
    );

    assert.notEqual(suspendIndex, -1);
    assert.notEqual(showRecorderIndex, -1);
    assert.ok(suspendIndex < showRecorderIndex);
  });

  it("starts only from the explicit consented recording button", () => {
    assert.match(
      recorderSource,
      /label="Start lesson recording" onPress=\{\(\) => void startCapture\(\)\}/u,
    );
    assert.match(recorderSource, /requestRecordingPermissionsAsync\(\)/u);
    assert.match(recorderSource, /allowsBackgroundRecording: false/u);
    assert.match(recorderSource, /AppState\.addEventListener/u);
    assert.match(recorderSource, /recorder\.pause\(\)/u);
  });

  it("uses the protected lesson pipeline and removes the local copy after save", () => {
    assert.match(recorderSource, /saveNativeLessonRecording/u);
    assert.match(recorderSource, /grantNativeLessonConsent/u);
    const deleteIndex = recorderSource.indexOf("if (file.exists) file.delete();");
    const readyIndex = recorderSource.indexOf('setPhase("ready");');

    assert.notEqual(deleteIndex, -1);
    assert.notEqual(readyIndex, -1);
    assert.ok(deleteIndex < readyIndex);
  });

  it("releases the recorder and local audio on an unexpected unmount", () => {
    assert.match(recorderSource, /return \(\) => \{[\s\S]*?recorder\.stop\(\)/u);
    assert.match(recorderSource, /localUriRef\.current \?\? recorder\.uri/u);
    assert.match(recorderSource, /setAudioModeAsync\(\{ allowsRecording: false \}\)/u);
  });

  it("resumes the existing Voice context instead of starting a new conversation", () => {
    assert.match(voiceSessionSource, /const resume = useCallback\(\(\) => \{[\s\S]*?connect\(true\)/u);
    assert.match(voiceSessionSource, /if \(!preserveLogicalSession \|\| !sessionIdRef\.current\) \{/u);
  });
});
