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
const modelSource = readFileSync(
  new URL("./lesson-recording-model.ts", import.meta.url),
  "utf8",
);
const trackerSource = readFileSync(
  new URL("./lesson-review-tracker.ts", import.meta.url),
  "utf8",
);
const recoveryCardSource = readFileSync(
  new URL("./lesson-review-recovery-card.tsx", import.meta.url),
  "utf8",
);
const activeObjectSource = readFileSync(
  new URL("../../../../web/lib/voice/active-object.ts", import.meta.url),
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
    const recorderSaveStart = recorderSource.indexOf("async function saveAndReview");
    const failedResultIndex = recorderSource.indexOf(
      'if (result.status === "failed")',
      recorderSaveStart,
    );
    const failedResultReturnIndex = recorderSource.indexOf("return;", failedResultIndex);
    const fallbackTrackingIndex = recorderSource.indexOf(
      "if (!reviewPointerRemembered)",
      failedResultIndex,
    );
    assert.ok(failedResultIndex < failedResultReturnIndex);
    assert.ok(failedResultReturnIndex < fallbackTrackingIndex);
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
    assert.match(uploadSource, /parseNativeLessonReviewOutcome\(body\)/u);
    assert.match(modelSource, /value\.status !== "failed"[\s\S]*?"review_failed"/u);
    assert.match(
      recorderSource,
      /result\.status === "review_failed"[\s\S]*?setPhase\("review_failed"\)/u,
    );
  });

  it("persists the saved lesson id and offers only server-approved retry", () => {
    assert.match(uploadSource, /`\/api\/lessons\/\$\{lessonId\}\/retry`/u);
    assert.match(recorderSource, /setSavedLessonId\(result\.lessonId\)/u);
    const saveStart = recorderSource.indexOf("async function saveAndReview");
    const rememberIndex = recorderSource.indexOf(
      "await rememberReviewPointer(result.lessonId)",
      saveStart,
    );
    const deleteIndex = recorderSource.indexOf("deleteLocalRecording(localUri)", rememberIndex);
    assert.ok(saveStart < rememberIndex);
    assert.ok(rememberIndex < deleteIndex);
    assert.match(
      recorderSource,
      /reviewRetryable && savedLessonId[\s\S]*?label="Try the review again"/u,
    );
    assert.match(
      recorderSource,
      /result\.status === "request_failed"[\s\S]*?setPhase\("review_failed"\)/u,
    );
    assert.match(recorderSource, /accessibilityRole="alert"/u);
  });

  it("persists the review pointer immediately after finish and before status polling", () => {
    const saveStart = uploadSource.indexOf("export async function saveNativeLessonRecording");
    const finishIndex = uploadSource.indexOf("if (!finishResponse.ok)", saveStart);
    const acceptedIndex = uploadSource.indexOf("lessonSaved = true", finishIndex);
    const callbackIndex = uploadSource.indexOf("await input.onLessonSaved?.(lessonId)", acceptedIndex);
    const pollIndex = uploadSource.indexOf("await loadReadyReview(lessonId, token)", callbackIndex);

    assert.ok(saveStart < finishIndex);
    assert.ok(finishIndex < acceptedIndex);
    assert.ok(acceptedIndex < callbackIndex);
    assert.ok(callbackIndex < pollIndex);
    assert.match(uploadSource, /if \(lessonSaved && lessonId\) \{[\s\S]*?status: "processing"/u);
    assert.match(recorderSource, /onLessonSaved: async \(lessonId\) => \{[\s\S]*?rememberReviewPointer\(lessonId\)/u);
  });

  it("recovers pending reviews after recorder unmount or app restart", () => {
    assert.match(trackerSource, /@react-native-async-storage\/async-storage/u);
    assert.match(trackerSource, /homa:lesson-review-tracker:v1/u);
    assert.match(trackerSource, /lessonReviewTrackerKey\(familyId/u);
    assert.doesNotMatch(trackerSource, /localUri|blobUrl|audioBytes/u);
    assert.match(voiceScreenSource, /loadTrackedLessonReviews\(familyId\)/u);
    assert.match(voiceScreenSource, /loadNativeLessonReviewStatus\(lesson\.lessonId\)/u);
    assert.match(voiceScreenSource, /AppState\.addEventListener\("change"/u);
    assert.match(voiceScreenSource, /<LessonReviewRecoveryCard/u);
    assert.match(voiceScreenSource, /familyId=\{family\.id\}/u);
    assert.match(recoveryCardSource, /import \{ Button \}/u);
    assert.match(recoveryCardSource, /accessibilityRole="header"/u);
    assert.match(recoveryCardSource, /announceForAccessibility/u);
    assert.doesNotMatch(recoveryCardSource, /numberOfLines/u);
    assert.match(voiceScreenSource, /<ScrollView/u);
  });

  it("hands the exact saved review to Voice and consumes it only after a reply", () => {
    assert.match(voiceScreenSource, /onResumeVoice=\{\(prompt, reviewedLessonId\) =>/u);
    assert.match(recorderSource, /This exact saved lesson review/u);
    assert.doesNotMatch(recorderSource, /newest lesson review/u);
    assert.match(voiceScreenSource, /kind: "recording"[\s\S]*?objectId: reviewedLessonId/u);
    assert.match(voiceScreenSource, /activeObjectKey\(activeObject\)[\s\S]*?session\.sendText/u);
    assert.match(
      voiceScreenSource,
      /session\.lastAssistantText === pending\.assistantTextBefore[\s\S]*?forgetTrackedLessonReview/u,
    );
    assert.match(voiceSessionSource, /if \(!channel \|\| text\.length === 0\) return false/u);
    assert.match(activeObjectSource, /reference\.kind === "recording"/u);
    assert.match(
      activeObjectSource,
      /reference\.version === ACTIVE_OBJECT_CURRENT_VERSION[\s\S]*?review: row\.review_summary/u,
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
