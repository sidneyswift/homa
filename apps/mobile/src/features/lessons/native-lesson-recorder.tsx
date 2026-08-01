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

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import {
  formatLessonElapsed,
  recorderPhaseCopy,
  type LessonRecorderPhase,
  type PreparedLessonRecording,
} from "./lesson-recording-model";

const MINIMUM_FREE_SPACE_BYTES = 100 * 1024 * 1024;
const RECORDING_OPTIONS = {
  ...RecordingPresets.LOW_QUALITY,
  directory: "document" as const,
};

function localTestNotes(childName: string): string[] {
  return [
    `This test records audio for ${childName} only on this phone.`,
    "Homa does not upload, save, transcribe, or review this recording.",
    "Returning to Voice deletes the recording from this phone.",
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
  intent,
  onCancel,
  onResumeVoice,
}: {
  intent: PreparedLessonRecording;
  onCancel: () => void;
  onResumeVoice: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<LessonRecorderPhase>("consent");
  const [localUri, setLocalUri] = useState<string | null>(null);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(localUri);
  const phaseRef = useRef<LessonRecorderPhase>(phase);
  const captureObservedRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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
      setPhase("review");
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      setPhase("interrupted");
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

  function deleteLocalRecordingAndResume() {
    const uri = localUri ?? recorder.uri;
    if (uri) {
      const file = new File(uri);
      if (file.exists) file.delete();
    }
    onResumeVoice();
  }

  const elapsed = Math.round(recorderState.durationMillis / 1000);
  const canDiscard = ["recording", "paused", "interrupted", "review"].includes(phase);

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
            <Text style={styles.cardTitle}>About this local test</Text>
            {localTestNotes(intent.childName).map((commitment) => (
              <View key={commitment} style={styles.commitmentRow}>
                <View style={styles.dot} />
                <Text style={styles.body}>{commitment}</Text>
              </View>
            ))}
            <PrimaryButton
              label="Continue"
              onPress={() => setPhase("confirm")}
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
                <Text style={styles.cardTitle}>Local test only</Text>
                <Text style={styles.body}>
                  This build can record and play audio on this phone, but it cannot save the lesson to Homa. Returning to Voice deletes the audio.
                </Text>
                <PrimaryButton label="Test recording on this phone" onPress={() => void startCapture()} />
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
                  Homa cannot save this recording yet. Returning to Voice deletes it from this phone.
                </Text>
                <PrimaryButton label="Delete audio and return to Voice" onPress={deleteLocalRecordingAndResume} />
              </View>
            ) : null}
          </>
        )}

        {phase !== "review" ? (
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
  eyebrow: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, fontWeight: "700", color: colors.brand, textTransform: "uppercase", letterSpacing: 1.1 },
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
  primaryButton: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.brand, paddingHorizontal: space.lg },
  primaryButtonText: { fontFamily: fontFamilies.body, fontSize: fontSize.base, fontWeight: "700", color: colors.onBrand },
  actions: { flexDirection: "row", gap: space.sm },
  secondaryButton: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: space.md },
  secondaryButtonText: { fontFamily: fontFamilies.body, fontSize: fontSize.base, fontWeight: "600", color: colors.textStrong },
  stopButton: { minHeight: 48, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: radius.pill, backgroundColor: colors.brand },
  stopButtonText: { fontFamily: fontFamilies.body, fontSize: fontSize.base, fontWeight: "700", color: colors.onBrand },
  unsavedNote: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.textMuted },
  discardButton: { minHeight: 44, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: space.xs, paddingHorizontal: space.md },
  discardText: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted },
});
