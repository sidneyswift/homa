import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { Mic, MicOff, X } from "lucide-react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import { emitFamilyEvent } from "../../lib/events";
import { useFamilyData } from "../family/use-family-data";
import { NativeLessonRecorder } from "../lessons/native-lesson-recorder";
import {
  deriveLessonRecordingSignals,
  type PreparedLessonRecording,
} from "../lessons/lesson-recording-model";
import {
  readyPrintMessage,
  runPreparedMaterialPrint,
} from "../materials/material-print";
import { deriveCharacterState } from "./character-state";
import { HomaCharacter } from "./homa-character";
import {
  applyOverlaySignal,
  deriveOverlaySignals,
  dismissActiveOverlay,
  EMPTY_OVERLAY_MODEL,
  type OverlayModelState,
} from "./overlay-model";
import { OverlayHost } from "./overlay-host";
import { ReplySheet } from "./reply-sheet";
import { TranscriptRibbon } from "./transcript-ribbon";
import { useVoiceSession } from "./use-voice-session";

const CHARACTER_SIZE = 240;
const PUCK_SIZE = 72;
const AURA_SIZE = CHARACTER_SIZE * 2.4;
const NIGHT_NAVY = "#151B27";
const CONTROL_FILL_LIGHT = "rgba(255,255,255,0.72)";
const CONTROL_FILL_DARK = "rgba(51,46,41,0.72)";

function GoldAuraField({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute" }} pointerEvents="none">
      <Defs>
        <RadialGradient id="voiceAuraField" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={palette.gold100} stopOpacity={1} />
          <Stop offset="45%" stopColor={palette.gold100} stopOpacity={0.5} />
          <Stop offset="100%" stopColor={palette.gold100} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#voiceAuraField)" opacity={0.5} />
    </Svg>
  );
}

/**
 * Homa's primary native conversation. A single purposeful tap starts the
 * microphone, then the session stays hands-free until the parent ends it.
 * Text is still available, just not placed ahead of the spoken relationship.
 */
export function VoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const [overlayModel, setOverlayModel] = useState<OverlayModelState>(EMPTY_OVERLAY_MODEL);
  const activeMaterial = overlayModel.active?.kind === "material"
    && overlayModel.active.material.id
    ? { kind: "material" as const, id: overlayModel.active.material.id }
    : null;
  const session = useVoiceSession(activeMaterial);
  const announceResult = session.announceResult;
  const handoffReady = session.handoffReady;
  const suspendVoice = session.suspend;
  const { family } = useFamilyData();
  const [replyOpen, setReplyOpen] = useState(false);
  const [printNotice, setPrintNotice] = useState<{ key: string; message: string } | null>(null);
  const [pendingLesson, setPendingLesson] = useState<PreparedLessonRecording | null>(null);
  const [activeLessonRecorder, setActiveLessonRecorder] = useState<PreparedLessonRecording | null>(null);
  const hoursKeyRef = useRef(0);
  const handledKeysRef = useRef<Set<string> | null>(null);
  const handledLessonKeysRef = useRef<Set<string> | null>(null);
  const handledPrintKeysRef = useRef(new Set<string>());
  const fieldHeight = useSharedValue(0);
  const puck = useSharedValue(0);
  const messages = session.messages;

  if (handledKeysRef.current === null) {
    handledKeysRef.current = new Set(deriveOverlaySignals([...messages], new Set()).keys);
  }
  if (handledLessonKeysRef.current === null) {
    handledLessonKeysRef.current = new Set(
      deriveLessonRecordingSignals([...messages], new Set()).keys,
    );
  }

  useEffect(() => {
    const handled = handledKeysRef.current;
    if (!handled) return;
    const { signals } = deriveOverlaySignals([...messages], handled);
    if (signals.length === 0) return;
    for (const signal of signals) handled.add(signal.key);
    setOverlayModel((current) => signals.reduce(applyOverlaySignal, current));
  }, [messages]);

  useEffect(() => {
    const handled = handledLessonKeysRef.current;
    if (!handled) return;
    const { signals } = deriveLessonRecordingSignals([...messages], handled);
    const signal = signals.at(-1);
    if (!signal) return;
    for (const candidate of signals) handled.add(candidate.key);
    setPendingLesson(signal.intent);
  }, [messages]);

  // Let Homa finish the spoken handoff first. Once the realtime session is
  // listening again, release WebRTC's microphone before expo-audio can own it.
  useEffect(() => {
    if (!pendingLesson || !handoffReady) return;
    const timer = setTimeout(() => {
      suspendVoice();
      setActiveLessonRecorder(pendingLesson);
      setPendingLesson(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [handoffReady, pendingLesson, suspendVoice]);

  useEffect(() => {
    const signal = overlayModel.active;
    if (signal?.kind !== "material" || !signal.printRequest) return;
    if (handledPrintKeysRef.current.has(signal.key)) return;
    handledPrintKeysRef.current.add(signal.key);
    setPrintNotice({ key: signal.key, message: readyPrintMessage(signal.printRequest) });
    void runPreparedMaterialPrint(signal.printRequest).then((result) => {
      setPrintNotice({ key: signal.key, message: result.message });
      announceResult(result.message);
      if (family?.id) {
        void emitFamilyEvent(family.id, "materials.print_result", {
          family_id: family.id,
          material_id: signal.printRequest!.materialId,
          outcome: result.status,
          requested_copies: signal.printRequest!.copies,
          pages_selected: signal.printRequest!.pageIndexes.length,
          answer_key_excluded: signal.printRequest!.answerKeyExcluded,
        });
      }
    });
  }, [announceResult, family?.id, overlayModel.active]);

  const activeSignal = overlayModel.active;
  const overlayActive = activeSignal !== null && activeSignal.kind !== "receipt";
  const visiblePrintNotice = printNotice
    && activeSignal?.kind === "material"
    && printNotice.key === activeSignal.key
    ? printNotice.message
    : null;
  if (overlayActive && replyOpen) setReplyOpen(false);

  useEffect(() => {
    puck.value = withTiming(overlayActive ? 1 : 0, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [overlayActive, puck]);

  const characterState = deriveCharacterState({
    composerFocused: false,
    turnActive: session.turnActive,
    assistantTextStreaming: session.assistantTextStreaming,
  });
  const statusText = overlayActive
    ? null
    : characterState === "thinking"
      ? (session.busyDetail ?? "getting ready")
      : characterState === "speaking"
        ? "speaking"
        : session.failed
          ? (session.busyDetail ?? "We got cut off")
          : "Tap Homa to start talking";
  const characterLayerStyle = useAnimatedStyle(() => {
    if (fieldHeight.value === 0) return { opacity: 0 };
    return { opacity: 1 - puck.value, top: fieldHeight.value * 0.43 - AURA_SIZE / 2 };
  });
  const surface = dark ? NIGHT_NAVY : colors.page;
  const controlFill = dark ? CONTROL_FILL_DARK : CONTROL_FILL_LIGHT;
  const controlBorder = dark ? palette.stone700 : colors.borderSubtle;
  const controlText = dark ? palette.stone50 : colors.textStrong;

  function handleFieldLayout(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height;
    fieldHeight.value = fieldHeight.value === 0
      ? height
      : withTiming(height, { duration: 260, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System });
  }

  function leaveVoice() {
    session.end();
    router.replace("/chat");
  }

  if (activeLessonRecorder) {
    return (
      <NativeLessonRecorder
        intent={activeLessonRecorder}
        onCancel={() => {
          setActiveLessonRecorder(null);
          session.resume();
        }}
        onResumeVoice={() => {
          setActiveLessonRecorder(null);
          session.resume();
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      <View style={{ flex: 1 }} onLayout={handleFieldLayout}>
        <Animated.View
          pointerEvents={overlayActive ? "none" : "auto"}
          style={[{ position: "absolute", left: 0, right: 0, alignItems: "center" }, characterLayerStyle]}
        >
          <View style={{ width: AURA_SIZE, height: AURA_SIZE, alignItems: "center", justifyContent: "center" }}>
            <GoldAuraField size={AURA_SIZE} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={session.turnActive ? "End voice conversation" : "Start talking with Homa"}
              onPress={session.turnActive ? session.end : session.start}
              hitSlop={20}
            >
              <HomaCharacter state={characterState} size={CHARACTER_SIZE} />
            </Pressable>
          </View>
          {statusText ? (
            <Text style={{ marginTop: -space.xl, fontFamily: fontFamilies.body, fontSize: fontSize.base, color: dark ? palette.stone300 : colors.textMuted, textAlign: "center" }}>
              {statusText}
            </Text>
          ) : null}
        </Animated.View>

        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TranscriptRibbon
            userText={session.turnActive && !session.assistantTextStreaming ? session.lastUserText : null}
            assistantText={session.turnActive && !session.assistantTextStreaming ? null : session.lastAssistantText}
            failed={session.failed}
            onRetry={session.retry}
            onPressReply={() => setReplyOpen(true)}
            tone={dark ? "dark" : "light"}
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.md) }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use text chat"
          onPress={leaveVoice}
          hitSlop={8}
          style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: controlFill, opacity: pressed ? 0.7 : 1 })}
        >
          <X size={18} color={dark ? palette.stone300 : colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={session.turnActive ? "End conversation" : "Start talking"}
          onPress={session.turnActive ? session.end : session.start}
          style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: controlBorder, backgroundColor: controlFill }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            {session.turnActive ? <MicOff size={16} color={controlText} /> : <Mic size={16} color={controlText} />}
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: controlText }}>
              {session.turnActive ? "End conversation" : "Talk to Homa"}
            </Text>
          </View>
        </Pressable>
      </View>

      {replyOpen && !overlayActive && session.lastAssistantText ? (
        <ReplySheet text={session.lastAssistantText} onDismiss={() => setReplyOpen(false)} />
      ) : null}
      <OverlayHost
        signal={activeSignal}
        onDismiss={() => setOverlayModel((current) => dismissActiveOverlay(current))}
        onAnswer={(message) => session.sendText(message)}
        onMaterialAction={(action) => {
          if (action === "print") session.sendText("Print this.");
          if (action === "keep") session.sendText("I love it. Keep this one.");
          if (action === "change") session.sendText("I want to change this material.");
          if (action === "earlier") session.sendText("Show me the earlier version of this material.");
        }}
        printNotice={visiblePrintNotice}
        onReceiptPress={(signal) => {
          if (signal.toolName === "log_hours") {
            hoursKeyRef.current += 1;
            setOverlayModel((current) => applyOverlaySignal(current, { kind: "hours", key: `voice-hours-${hoursKeyRef.current}` }));
            return;
          }
          setOverlayModel((current) => dismissActiveOverlay(current));
        }}
        float={<HomaCharacter state={characterState} size={PUCK_SIZE} />}
      />
    </View>
  );
}
