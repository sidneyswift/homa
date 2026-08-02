import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { Pause, Play, RotateCcw, Square, Trash2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InlineError } from "../../components/ui/inline-error";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { reportCrash } from "../../lib/crash-reporting";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import {
  formatLessonElapsed,
  lessonReviewFailureCopy,
  recorderPhaseCopy,
  type LessonReviewFailureReason,
  type LessonRecorderPhase,
  type PreparedLessonRecording,
} from "./lesson-recording-model";
import {
  grantNativeLessonConsent,
  retryNativeLessonReview,
  saveNativeLessonRecording,
} from "./lesson-recording-upload";
import {
  rememberTrackedLessonReview,
} from "./lesson-review-tracker";

const MINIMUM_FREE_SPACE_BYTES = 100 * 1024 * 1024;
const RECORDING_OPTIONS = {
  ...RecordingPresets.LOW_QUALITY,
  directory: "document" as const,
};

function privacyNotes(childName: string): string[] {
  return [
    `This records ${childName}'s lesson and saves it in private storage only after you tap Save and review.`,
    "Homa transcribes the lesson, listens for learning moments, and adds evidence or observations to this child's progress.",
    "Raw audio deletes after 30 days unless the review finds a breakthrough or sweet moment. You can delete it sooner.",
    "Let everyone in the room know before you start recording.",
  ];
}

function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { opacity: disabled ? 0.45 : pressed ? 0.78 : 1 },
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function NativeLessonRecorder({
  familyId,
  intent,
  onCancel,
  onResumeVoice,
}: {
  familyId: string;
  intent: PreparedLessonRecording;
  onCancel: () => void;
  onResumeVoice: (prompt?: string, reviewedLessonId?: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<LessonRecorderPhase>("consent");
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [reviewSummary, setReviewSummary] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedLessonId, setSavedLessonId] = useState<string | null>(null);
  const [reviewRetryable, setReviewRetryable] = useState(false);
  const [reviewFailureReason, setReviewFailureReason] =
    useState<LessonReviewFailureReason>("unknown");
  const [reviewRetryError, setReviewRetryError] = useState<string | null>(null);
  const [reviewTrackingError, setReviewTrackingError] = useState<string | null>(null);
  useAccessibilityAnnouncement(recorderPhaseCopy(phase, intent.childName));
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(localUri);
  const phaseRef = useRef<LessonRecorderPhase>(phase);
  const localUriRef = useRef<string | null>(localUri);
  const captureObservedRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    localUriRef.current = localUri;
  }, [localUri]);

  useEffect(() => {
    return () => {
      void (async () => {
        if (["starting", "recording", "paused", "interrupted"].includes(phaseRef.current)) {
          await recorder.stop().catch(() => undefined);
        }
        const uri = localUriRef.current ?? recorder.uri;
        if (uri) {
          const file = new File(uri);
          if (file.exists) file.delete();
        }
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      })();
    };
  }, [recorder]);

  useEffect(() => {
    if (phase !== "recording") return;
    if (recorderState.isRecording) {
      captureObservedRef.current = true;
      return;
    }
    if (captureObservedRef.current && !recorderState.isRecording) {
      setPhase("interrupted");
    }
  }, [phase, recorderState.isRecording]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && phaseRef.current === "recording") {
        recorder.pause();
        setPhase("interrupted");
      }
    });
    return () => subscription.remove();
  }, [recorder]);

  async function startCapture() {
    if (Paths.availableDiskSpace < MINIMUM_FREE_SPACE_BYTES) {
      setPhase("low_storage");
      return;
    }
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPhase("permission_denied");
      return;
    }
    setPhase("starting");
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        allowsBackgroundRecording: false,
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
      });
      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      captureObservedRef.current = false;
      recorder.record();
      setPhase("recording");
    } catch {
      setPhase("interrupted");
    }
  }

  async function agreeAndContinue() {
    try {
      await grantNativeLessonConsent();
      setPhase("confirm");
    } catch {
      setPhase("consent_failed");
    }
  }

  function pauseCapture() {
    recorder.pause();
    setPhase("paused");
  }

  function resumeCapture() {
    recorder.record();
    setPhase("recording");
  }

  async function stopCapture() {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("missing-recording");
      setLocalUri(uri);
      setRecordedDuration(Math.max(1, Math.round(recorderState.durationMillis / 1000)));
      setPhase("review");
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      setPhase("interrupted");
    }
  }

  function deleteLocalRecording(uri: string) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
      setLocalUri(null);
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-lesson-recorder",
        operation: "delete-local-recording",
      });
    }
  }

  async function rememberReviewPointer(lessonId: string): Promise<boolean> {
    try {
      await rememberTrackedLessonReview(familyId, {
        lessonId,
        childId: intent.childId,
        childName: intent.childName,
        purpose: intent.purpose,
        savedAt: new Date().toISOString(),
      });
      setReviewTrackingError(null);
      return true;
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-lesson-recorder",
        operation: "remember-review-pointer",
      });
      setReviewTrackingError(
        "The lesson is saved, but Homa could not keep its review link on this phone. Keep this screen open and try again.",
      );
      return false;
    }
  }

  async function saveAndReview() {
    if (!localUri) return;
    setSaveError(null);
    setUploadPercent(0);
    setPhase("saving");
    let result;
    let reviewPointerRemembered = false;
    try {
      result = await saveNativeLessonRecording({
        intent,
        uri: localUri,
        durationSeconds: recordedDuration,
        onProgress: (percentage) => {
          setUploadPercent(percentage);
          if (percentage >= 100) setPhase("analyzing");
        },
        onLessonSaved: async (lessonId) => {
          setSavedLessonId(lessonId);
          reviewPointerRemembered = await rememberReviewPointer(lessonId);
          if (reviewPointerRemembered) deleteLocalRecording(localUri);
        },
      });
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-lesson-recorder",
        operation: "save-recording",
      });
      setSaveError(
        "The recording is still on this phone. Check your connection and try saving again.",
      );
      setPhase("save_failed");
      return;
    }
    if (result.status === "failed") {
      setSaveError(result.reason);
      setPhase("save_failed");
      return;
    }
    setSavedLessonId(result.lessonId);
    if (!reviewPointerRemembered) {
      reviewPointerRemembered = await rememberReviewPointer(result.lessonId);
      if (reviewPointerRemembered) deleteLocalRecording(localUri);
    }
    if (result.status === "ready") {
      setReviewSummary(result.review.summary);
      setReviewRetryable(false);
      setPhase("ready");
      return;
    }
    if (result.status === "review_failed") {
      setReviewRetryable(result.retryable);
      setReviewFailureReason(result.reason);
      setPhase("review_failed");
      return;
    }
    setPhase("processing");
  }

  async function retryReview() {
    if (!savedLessonId || !reviewRetryable) return;
    setReviewRetryError(null);
    setPhase("analyzing");
    const result = await retryNativeLessonReview(savedLessonId);
    if (result.status === "request_failed") {
      setReviewRetryError(result.reason);
      setPhase("review_failed");
      return;
    }
    if (result.status === "ready") {
      if (localUri && await rememberReviewPointer(savedLessonId)) {
        deleteLocalRecording(localUri);
      }
      setReviewSummary(result.review.summary);
      setReviewRetryable(false);
      setPhase("ready");
      return;
    }
    if (result.status === "review_failed") {
      setReviewRetryable(result.retryable);
      setReviewFailureReason(result.reason);
      setPhase("review_failed");
      return;
    }
    if (reviewTrackingError && await rememberReviewPointer(savedLessonId)) {
      if (localUri) deleteLocalRecording(localUri);
    }
    setReviewRetryable(false);
    setPhase("processing");
  }

  async function retryReviewTracking() {
    if (!savedLessonId) return;
    if (await rememberReviewPointer(savedLessonId)) {
      if (localUri) deleteLocalRecording(localUri);
    }
  }

  function discard() {
    Alert.alert(
      "Discard this recording?",
      "This removes the audio from this phone. It cannot be undone.",
      [
        { text: "Keep recording", style: "cancel" },
        {
          text: "Discard recording",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (phaseRef.current === "recording" || phaseRef.current === "paused") {
                await recorder.stop().catch(() => undefined);
              }
              const uri = localUri ?? recorder.uri;
              if (uri) {
                const file = new File(uri);
                if (file.exists) file.delete();
              }
              await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
              onCancel();
            })();
          },
        },
      ],
    );
  }

  const elapsed = Math.round(recorderState.durationMillis / 1000);
  const canDiscard = ["recording", "paused", "interrupted", "review", "save_failed"].includes(phase);

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, space.lg) }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Lesson recording</Text>
        <Text style={styles.title}>{intent.childName}</Text>
        <Text style={styles.purpose}>{intent.purpose}</Text>

        {phase === "consent" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Before Homa listens</Text>
            {privacyNotes(intent.childName).map((commitment) => (
              <View key={commitment} style={styles.commitmentRow}>
                <View style={styles.dot} />
                <Text style={styles.body}>{commitment}</Text>
              </View>
            ))}
            <PrimaryButton
              label="I agree, continue"
              onPress={() => void agreeAndContinue()}
            />
          </View>
        ) : (
          <>
            <View style={styles.timerCard}>
              <Text accessibilityLabel={`${elapsed} seconds elapsed`} style={styles.timer}>
                {formatLessonElapsed(elapsed)}
              </Text>
              <Text style={styles.status}>{recorderPhaseCopy(phase, intent.childName)}</Text>
            </View>

            <View style={styles.privacyCard}>
              <Text style={styles.privacyTitle}>A quick privacy check</Text>
              <Text style={styles.body}>
                Let everyone in the room know the lesson is being recorded. Homa never identifies anyone by voice.
              </Text>
            </View>

            {phase === "confirm" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Ready when you are</Text>
                <Text style={styles.body}>
                  The microphone is still off. Tap Start lesson recording when everyone in the room knows you are recording.
                </Text>
                <PrimaryButton label="Start lesson recording" onPress={() => void startCapture()} />
              </View>
            ) : null}
            {phase === "recording" ? (
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={pauseCapture} style={styles.secondaryButton}>
                  <Pause size={18} color={colors.textStrong} />
                  <Text style={styles.secondaryButtonText}>Pause</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void stopCapture()} style={styles.stopButton}>
                  <Square size={17} color={colors.onBrand} fill={colors.onBrand} />
                  <Text style={styles.stopButtonText}>Stop</Text>
                </Pressable>
              </View>
            ) : null}
            {phase === "paused" || phase === "interrupted" ? (
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={resumeCapture} style={styles.secondaryButton}>
                  <RotateCcw size={18} color={colors.textStrong} />
                  <Text style={styles.secondaryButtonText}>Resume</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void stopCapture()} style={styles.stopButton}>
                  <Square size={17} color={colors.onBrand} fill={colors.onBrand} />
                  <Text style={styles.stopButtonText}>Stop</Text>
                </Pressable>
              </View>
            ) : null}
            {phase === "permission_denied" ? (
              <PrimaryButton label="Open microphone settings" onPress={() => void Linking.openSettings()} />
            ) : null}
            {phase === "low_storage" ? (
              <PrimaryButton label="Check again" onPress={() => void startCapture()} />
            ) : null}
            {phase === "review" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recording playback</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => (player.playing ? player.pause() : player.play())}
                  style={styles.secondaryButton}
                >
                  {player.playing ? (
                    <Pause size={18} color={colors.textStrong} />
                  ) : (
                    <Play size={18} color={colors.textStrong} />
                  )}
                  <Text style={styles.secondaryButtonText}>
                    {player.playing ? "Pause playback" : "Play recording"}
                  </Text>
                </Pressable>
                <Text style={styles.unsavedNote}>
                  Nothing has left this phone yet. Save it privately for Homa to transcribe and review, or discard it.
                </Text>
                <PrimaryButton label="Save and review with Homa" onPress={() => void saveAndReview()} />
              </View>
            ) : null}
            {phase === "saving" || phase === "analyzing" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{phase === "saving" ? `Saving privately · ${uploadPercent}%` : "Homa is reviewing the lesson"}</Text>
                <Text style={styles.body}>{recorderPhaseCopy(phase, intent.childName)}</Text>
              </View>
            ) : null}
            {phase === "save_failed" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>The recording stayed on this phone</Text>
                <Text style={styles.body}>{saveError ?? recorderPhaseCopy(phase, intent.childName)}</Text>
                <PrimaryButton label="Try saving again" onPress={() => void saveAndReview()} />
              </View>
            ) : null}
            {phase === "processing" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recording saved</Text>
                <Text style={styles.body}>
                  {recorderPhaseCopy(phase, intent.childName)}
                </Text>
                {reviewTrackingError ? <InlineError message={reviewTrackingError} /> : null}
                {reviewTrackingError ? (
                  <PrimaryButton
                    label="Keep checking this lesson"
                    onPress={() => void retryReviewTracking()}
                  />
                ) : (
                  <PrimaryButton
                    label="Back to Voice"
                    onPress={() => onResumeVoice()}
                  />
                )}
              </View>
            ) : null}
            {phase === "review_failed" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Lesson saved</Text>
                <Text style={styles.body}>
                  {lessonReviewFailureCopy(reviewFailureReason)}
                </Text>
                {reviewRetryError ? <InlineError message={reviewRetryError} /> : null}
                {reviewTrackingError ? <InlineError message={reviewTrackingError} /> : null}
                {reviewRetryable && savedLessonId ? (
                  <PrimaryButton
                    label="Try the review again"
                    onPress={() => void retryReview()}
                  />
                ) : null}
                {reviewTrackingError ? (
                  <PrimaryButton
                    label="Keep checking this lesson"
                    onPress={() => void retryReviewTracking()}
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onResumeVoice()}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Back to Voice</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
            {phase === "consent_failed" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Nothing was recorded</Text>
                <Text style={styles.body}>{recorderPhaseCopy(phase, intent.childName)}</Text>
                <PrimaryButton label="Try again" onPress={() => void agreeAndContinue()} />
              </View>
            ) : null}
            {phase === "ready" ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Lesson review ready</Text>
                <Text style={styles.body}>{reviewSummary}</Text>
                <PrimaryButton
                  label="Talk with Homa about this lesson"
                  onPress={() => onResumeVoice(
                    `This exact saved lesson review is for ${intent.childName}'s ${intent.purpose}. Talk with me about the evidence you noticed and what we should try next.`,
                    savedLessonId ?? undefined,
                  )}
                />
              </View>
            ) : null}
          </>
        )}

        {!(["review", "saving", "analyzing", "processing", "review_failed", "ready"] as LessonRecorderPhase[]).includes(phase) ? (
          <Pressable
            accessibilityRole="button"
            onPress={canDiscard ? discard : onCancel}
            style={styles.discardButton}
          >
            <Trash2 size={17} color={colors.textMuted} />
            <Text style={styles.discardText}>{canDiscard ? "Discard recording" : "Cancel"}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md },
  eyebrow: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, fontWeight: "700", color: colors.textStrong, textTransform: "uppercase", letterSpacing: 1.1 },
  title: { fontFamily: fontFamilies.display, fontSize: fontSize.xxxl, fontWeight: "700", color: colors.textStrong },
  purpose: { marginTop: -space.sm, fontFamily: fontFamilies.body, fontSize: fontSize.lg, color: colors.textBody },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSubtle, backgroundColor: colors.card },
  cardTitle: { fontFamily: fontFamilies.display, fontSize: fontSize.xl, fontWeight: "600", color: colors.textStrong },
  commitmentRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  dot: { width: 7, height: 7, marginTop: 7, borderRadius: radius.pill, backgroundColor: palette.sage500 },
  body: { flex: 1, fontFamily: fontFamilies.body, fontSize: fontSize.base, lineHeight: 22, color: colors.textBody },
  timerCard: { alignItems: "center", gap: space.sm, paddingVertical: space.xl, paddingHorizontal: space.lg, borderRadius: radius.xl, backgroundColor: palette.gold100 },
  timer: { fontFamily: fontFamilies.display, fontSize: 52, fontWeight: "700", fontVariant: ["tabular-nums"], color: palette.goldInk },
  status: { fontFamily: fontFamilies.body, fontSize: fontSize.base, lineHeight: 22, textAlign: "center", color: palette.goldInk },
  privacyCard: { padding: space.md, borderRadius: radius.lg, backgroundColor: palette.sage50 },
  privacyTitle: { marginBottom: space.xs, fontFamily: fontFamilies.display, fontSize: fontSize.base, fontWeight: "600", color: colors.textStrong },
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.brandHover, paddingHorizontal: space.lg },
  primaryButtonText: { fontFamily: fontFamilies.body, fontSize: fontSize.base, fontWeight: "700", color: colors.onBrand },
  actions: { flexDirection: "row", gap: space.sm },
  secondaryButton: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: space.md },
  secondaryButtonText: { fontFamily: fontFamilies.body, fontSize: fontSize.base, fontWeight: "600", color: colors.textStrong },
  stopButton: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: radius.pill, backgroundColor: colors.brandHover },
  stopButtonText: { fontFamily: fontFamilies.body, fontSize: fontSize.base, fontWeight: "700", color: colors.onBrand },
  unsavedNote: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.textMuted },
  retryError: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.textBody },
  discardButton: { minHeight: 44, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md },
  discardText: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted },
});
