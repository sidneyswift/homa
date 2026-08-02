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
const uploadSource = readFileSync(
  new URL("./lesson-recording-upload.ts", import.meta.url),
  "utf8",
);
const uploadRouteSource = readFileSync(
  new URL("../../../../web/app/api/lessons/upload/route.ts", import.meta.url),
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

  it("keeps local audio recoverable when session or creation fails", () => {
    const saveStart = uploadSource.indexOf(
      "export async function saveNativeLessonRecording",
    );
    const tryIndex = uploadSource.indexOf("try {", saveStart);
    const sessionIndex = uploadSource.indexOf("token = await sessionToken()", saveStart);
    const createIndex = uploadSource.indexOf(
      'authenticatedFetch("/api/lessons", token',
      saveStart,
    );
    const catchIndex = uploadSource.indexOf("} catch (error) {", saveStart);

    assert.ok(saveStart < tryIndex);
    assert.ok(tryIndex < sessionIndex);
    assert.ok(sessionIndex < createIndex);
    assert.ok(createIndex < catchIndex);
    assert.match(
      recorderSource,
      /try \{[\s\S]*?await saveNativeLessonRecording[\s\S]*?\} catch \(cause\) \{[\s\S]*?setPhase\("save_failed"\)/u,
    );
    assert.match(
      recorderSource,
      /setPhase\("save_failed"\);[\s\S]*?return;[\s\S]*?const file = new File\(localUri\)/u,
    );
  });

  it("keeps a saved but unfinished review distinct from ready", () => {
    assert.match(
      recorderSource,
      /if \(result\.status === "ready"\) \{[\s\S]*?setPhase\("ready"\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?setPhase\("processing"\);/u,
    );
    assert.match(
      recorderSource,
      /phase === "processing"[\s\S]*?Recording saved[\s\S]*?label="Back to Voice"[\s\S]*?onPress=\{\(\) => onResumeVoice\(\)\}/u,
    );
    assert.doesNotMatch(
      recorderSource,
      /setReviewSummary\([\s\S]*?still finishing[\s\S]*?setPhase\("ready"\)/u,
    );
    assert.match(uploadSource, /body\.status === "failed"[\s\S]*?status: "review_failed"/u);
    assert.match(
      recorderSource,
      /result\.status === "review_failed"[\s\S]*?setPhase\("review_failed"\)/u,
    );
  });

  it("streams native audio through a family-scoped presigned upload", () => {
    assert.doesNotMatch(uploadSource, /@vercel\/blob/u);
    assert.match(uploadSource, /createUploadTask\(upload\.url/u);
    assert.match(uploadSource, /uploadType: UploadType\.BINARY_CONTENT/u);
    assert.match(uploadSource, /multipart: false/u);
    assert.match(uploadRouteSource, /resolveLessonRoute\(request\)/u);
    assert.match(uploadRouteSource, /if \(!context\.consented\)/u);
    assert.match(uploadRouteSource, /getLessonForFamily/u);
    assert.match(uploadRouteSource, /presignUrl\(signedToken/u);
    assert.match(uploadRouteSource, /parseStoreIdFromDelegationToken/u);
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
