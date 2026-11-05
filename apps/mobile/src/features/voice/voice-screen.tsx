import {
  ACTIVE_OBJECT_CURRENT_VERSION,
  activeObjectKey,
  type ActiveObjectReference,
} from "@homa/core";
import { useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../../components/design/icon";
import { colors, darkColors, fontFamilies, fontSize, radius, space } from "../../theme/app2";
import { reportCrash } from "../../lib/crash-reporting";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { emitFamilyEvent } from "../../lib/events";
import { useFamilyData } from "../family/use-family-data";
import { NativeLessonRecorder } from "../lessons/native-lesson-recorder";
import { LessonReviewRecoveryCard } from "../lessons/lesson-review-recovery-card";
import {
  lessonReviewRecoveryFingerprint,
  selectLessonReviewRecovery,
  type LessonReviewRecoveryAction,
  type TrackedLessonReviewStatus,
} from "../lessons/lesson-review-recovery-model";
import {
  forgetTrackedLessonReview,
  loadTrackedLessonReviews,
} from "../lessons/lesson-review-tracker";
import {
  deriveLessonRecordingSignals,
  type PreparedLessonRecording,
} from "../lessons/lesson-recording-model";
import {
  loadNativeLessonReviewStatus,
  retryNativeLessonReview,
} from "../lessons/lesson-recording-upload";
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
import type { StateRecordDocument } from "../../lib/state-records";
import { ReplySheet } from "./reply-sheet";
import { TranscriptRibbon } from "./transcript-ribbon";
import type { VoicePromptStarter } from "./voice-prompt-starters-model";
import { voicePromptStartersVisible } from "./voice-prompt-starters-model";
import { VoicePromptStarters } from "./voice-prompt-starters";
import { useVoiceWorkbench } from "./voice-workbench-provider";
import { voiceStatusAnnouncement } from "./voice-dock-model";

const CHARACTER_SIZE = 240;
const PUCK_SIZE = 72;
const AURA_SIZE = CHARACTER_SIZE * 2.4;
interface QueuedLessonReviewHandoff {
  familyId: string;
  lessonId: string;
  prompt: string;
  fingerprint: string;
  activeObject: ActiveObjectReference | null;
}

/**
 * Homa's primary native conversation. Opening the app starts the microphone
 * and Homa takes the first turn. Text stays available as a quiet fallback.
 */
export function VoiceScreen() {
  useKeepAwake("homa-voice-conversation");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const {
    session,
    activeObject,
    showActiveObject,
    clearActiveObject,
  } = useVoiceWorkbench();
  const startVoice = session.start;
  const autoStartedRef = useRef(false);
  const [overlayModel, setOverlayModel] = useState<OverlayModelState>(EMPTY_OVERLAY_MODEL);
  const activeMaterialId = overlayModel.active?.kind === "material"
    && overlayModel.active.material.id
    ? overlayModel.active.material.id
    : null;
  const announceResult = session.announceResult;
  const handoffReady = session.handoffReady;
  const pauseForMicrophoneOwner = session.pauseForMicrophoneOwner;
  const { family } = useFamilyData();
  const [replyOpen, setReplyOpen] = useState(false);
  const [startersRetired, setStartersRetired] = useState(false);
  const [printNotice, setPrintNotice] = useState<{ key: string; message: string } | null>(null);
  const [pendingLesson, setPendingLesson] = useState<PreparedLessonRecording | null>(null);
  const [activeLessonRecorder, setActiveLessonRecorder] = useState<PreparedLessonRecording | null>(null);
  const [trackedLessonReviews, setTrackedLessonReviews] = useState<TrackedLessonReviewStatus[]>([]);
  const [trackedLessonReviewsFamilyId, setTrackedLessonReviewsFamilyId] =
    useState<string | null>(null);
  const [hiddenLessonReviewStates, setHiddenLessonReviewStates] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [lessonRecoveryBusy, setLessonRecoveryBusy] = useState(false);
  const [lessonRecoveryError, setLessonRecoveryError] = useState<string | null>(null);
  const lessonResumePromptRef = useRef<string | null>(null);
  const queuedLessonReviewHandoffRef = useRef<QueuedLessonReviewHandoff | null>(null);
  const pendingLessonReviewConsumptionRef = useRef<(
    QueuedLessonReviewHandoff & { assistantTextBefore: string | null }
  ) | null>(null);
  const lessonRecoveryRefreshRef = useRef(0);
  const hoursKeyRef = useRef(0);
  const handledKeysRef = useRef<Set<string> | null>(null);
  const handledLessonKeysRef = useRef<Set<string> | null>(null);
  const handledPrintKeysRef = useRef(new Set<string>());
  const fieldHeight = useSharedValue(0);
  const puck = useSharedValue(0);
  const messages = session.messages;

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    startVoice();
  }, [startVoice]);

  const refreshTrackedLessonReviews = useCallback(async () => {
    const familyId = family?.id;
    const refresh = ++lessonRecoveryRefreshRef.current;
    if (!familyId) return;
    try {
      const lessons = await loadTrackedLessonReviews(familyId);
      const statuses = await Promise.all(
        lessons.map(async (lesson) => ({
          lesson,
          outcome: await loadNativeLessonReviewStatus(lesson.lessonId),
        })),
      );
      if (lessonRecoveryRefreshRef.current === refresh) {
        setTrackedLessonReviewsFamilyId(familyId);
        setTrackedLessonReviews(statuses);
        setLessonRecoveryError(null);
      }
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-voice",
        operation: "refresh-lesson-reviews",
      });
    }
  }, [family?.id]);

  const acceptLessonReviewHandoff = useCallback((handoff: QueuedLessonReviewHandoff) => {
    queuedLessonReviewHandoffRef.current = null;
    pendingLessonReviewConsumptionRef.current = {
      ...handoff,
      assistantTextBefore: session.lastAssistantText,
    };
    lessonRecoveryRefreshRef.current += 1;
    setHiddenLessonReviewStates((current) => new Map(current).set(
      handoff.lessonId,
      handoff.fingerprint,
    ));
    setLessonRecoveryBusy(false);
    setLessonRecoveryError(null);
  }, [session.lastAssistantText]);

  useEffect(() => {
    lessonRecoveryRefreshRef.current += 1;
    if (!family?.id) return;
    const initialTimer = setTimeout(() => {
      void refreshTrackedLessonReviews();
    }, 0);
    const timer = setInterval(() => {
      void refreshTrackedLessonReviews();
    }, 20_000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshTrackedLessonReviews();
    });
    return () => {
      lessonRecoveryRefreshRef.current += 1;
      clearTimeout(initialTimer);
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [family?.id, refreshTrackedLessonReviews]);

  if (handledKeysRef.current === null) {
    handledKeysRef.current = new Set(deriveOverlaySignals([...messages], new Set()).keys);
  }
  if (handledLessonKeysRef.current === null) {
    handledLessonKeysRef.current = new Set(
      deriveLessonRecordingSignals([...messages], new Set()).keys,
    );
  }

  useEffect(() => {
    if (!activeMaterialId) return;
    const reference = {
      kind: "material" as const,
      objectId: activeMaterialId,
      version: ACTIVE_OBJECT_CURRENT_VERSION,
    };
    showActiveObject(reference);
    return () => clearActiveObject(reference);
  }, [activeMaterialId, clearActiveObject, showActiveObject]);

  useEffect(() => {
    const handled = handledKeysRef.current;
    if (!handled) return;
    const { signals } = deriveOverlaySignals([...messages], handled);
    if (signals.length === 0) return;
    for (const signal of signals) handled.add(signal.key);
    const plannerRequested = signals.some((signal) => signal.kind === "planner");
    const overlaySignals = signals.filter((signal) => signal.kind !== "planner");
    if (overlaySignals.length > 0) {
      setOverlayModel((current) => overlaySignals.reduce(applyOverlaySignal, current));
    }
    if (plannerRequested) router.navigate("/planner");
  }, [messages, router]);

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
    if (!pendingLesson || !handoffReady || !family?.id) return;
    const timer = setTimeout(() => {
      pauseForMicrophoneOwner("Lesson recording has the microphone.");
      setActiveLessonRecorder(pendingLesson);
      setPendingLesson(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [family?.id, handoffReady, pauseForMicrophoneOwner, pendingLesson]);

  useEffect(() => {
    if (!handoffReady) return;
    const lessonHandoff = queuedLessonReviewHandoffRef.current;
    if (lessonHandoff) {
      const exactObjectReady = lessonHandoff.activeObject === null
        ? activeObject === null
        : activeObject !== null
          && activeObjectKey(activeObject) === activeObjectKey(lessonHandoff.activeObject);
      if (!exactObjectReady) return;
      if (session.sendText(lessonHandoff.prompt)) {
        acceptLessonReviewHandoff(lessonHandoff);
      }
      return;
    }
    const prompt = lessonResumePromptRef.current;
    if (prompt && session.sendText(prompt)) lessonResumePromptRef.current = null;
  }, [acceptLessonReviewHandoff, activeObject, handoffReady, session]);

  useEffect(() => {
    const pending = pendingLessonReviewConsumptionRef.current;
    if (
      !pending
      || session.lastAssistantText === null
      || session.lastAssistantText === pending.assistantTextBefore
    ) {
      return;
    }
    pendingLessonReviewConsumptionRef.current = null;
    if (pending.activeObject) clearActiveObject(pending.activeObject);
    void forgetTrackedLessonReview(pending.familyId, pending.lessonId)
      .then(() => {
        setTrackedLessonReviews((current) =>
          current.filter((item) => item.lesson.lessonId !== pending.lessonId));
      })
      .catch((cause) => {
        reportCrash(cause, {
          surface: "native-voice",
          operation: "forget-discussed-lesson-review",
        });
      });
  }, [clearActiveObject, session.lastAssistantText]);

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
  const activeLessonRecovery = selectLessonReviewRecovery(
    trackedLessonReviewsFamilyId === family?.id ? trackedLessonReviews : [],
    hiddenLessonReviewStates,
  );
  const recoveryVisible = activeLessonRecovery !== null && !overlayActive;
  const startersVisible = voicePromptStartersVisible({
    status: session.status,
    turnActive: session.turnActive,
    assistantHasReplied: session.lastAssistantText !== null,
    userHasReplied: session.lastUserText !== null,
    overlayOpen: activeSignal !== null || recoveryVisible,
    retired: startersRetired,
  });
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
  const statusText = startersVisible || overlayActive
    ? null
    : characterState === "thinking"
      ? (session.busyDetail ?? "getting ready")
      : characterState === "speaking"
        ? "speaking"
        : session.status === "paused"
          ? (session.pauseReason ?? "Voice paused")
          : session.muted
            ? "muted"
            : session.failed
              ? (session.busyDetail ?? "We got cut off")
              : session.turnActive
                ? "listening"
                : "Tap Homa to start talking";
  useAccessibilityAnnouncement(
    activeLessonRecorder || startersVisible || overlayActive || recoveryVisible
      ? null
      : voiceStatusAnnouncement({
          status: session.status,
          muted: session.muted,
          pauseReason: session.pauseReason,
          busyDetail: session.busyDetail,
        }),
  );
  const characterLayerStyle = useAnimatedStyle(() => {
    if (fieldHeight.value === 0) return { opacity: 0 };
    return { opacity: 1 - puck.value, top: fieldHeight.value * 0.43 - AURA_SIZE / 2 };
  });
  const surface = dark ? darkColors.page : colors.page;
  const controlFill = dark ? darkColors.surfaceRaised : colors.card;
  const controlBorder = dark ? darkColors.borderSubtle : colors.borderSubtle;
  const controlText = dark ? darkColors.textStrong : colors.textStrong;

  function handleFieldLayout(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height;
    fieldHeight.value = fieldHeight.value === 0
      ? height
      : withTiming(height, { duration: 260, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System });
  }

  function leaveVoice() {
    if (session.turnActive && !session.muted) session.toggleMute();
    router.replace("/chat");
  }

  function handlePromptStarter(starter: VoicePromptStarter) {
    setStartersRetired(true);
    if (starter.action.kind === "route") {
      router.navigate(starter.action.href);
      return;
    }
    session.sendText(starter.action.text);
  }

  function openStateRecord(document: StateRecordDocument) {
    setOverlayModel((current) => applyOverlaySignal(current, {
      kind: "material",
      key: `state-record:${document.id}`,
      material: {
        id: document.id,
        title: document.title,
        kind: "packet",
        skill: null,
        childName: null,
        previewUrl: document.previewUrl,
        pdfUrl: document.pdfUrl,
        pageCount: document.pageCount,
        status: document.status,
        revisesId: document.revisesId,
      },
    }));
  }

  function queueLessonReviewHandoff(handoff: QueuedLessonReviewHandoff) {
    queuedLessonReviewHandoffRef.current = handoff;
    if (handoff.activeObject) {
      showActiveObject(handoff.activeObject);
    } else {
      clearActiveObject();
    }
    setLessonRecoveryBusy(true);
    setLessonRecoveryError(
      "Voice is getting ready. This review will stay here until Homa can open it with you.",
    );
    if (session.status === "paused") session.resume();
    if (session.status === "failed") session.retry();
    if (session.status === "idle") session.start();
  }

  async function handleLessonRecoveryAction(action: LessonReviewRecoveryAction) {
    const recovery = activeLessonRecovery;
    const familyId = family?.id;
    if (!recovery || !familyId || lessonRecoveryBusy) return;
    const lessonId = recovery.lesson.lessonId;
    if (action === "later") {
      setLessonRecoveryError(null);
      setHiddenLessonReviewStates((current) => new Map(current).set(
        lessonId,
        lessonReviewRecoveryFingerprint(recovery.outcome),
      ));
      return;
    }
    if (action === "discuss") {
      const reviewReady = recovery.outcome.status === "ready";
      const handoff: QueuedLessonReviewHandoff = {
        familyId,
        lessonId,
        prompt: reviewReady
          ? `Talk with me about this lesson review for ${recovery.lesson.childName}'s ${recovery.lesson.purpose}. Explain the evidence you noticed and help me choose what to try next.`
          : `Homa could not finish the review for ${recovery.lesson.childName}'s ${recovery.lesson.purpose}. Ask what I noticed, then help me choose a useful next step without asking us to repeat the lesson.`,
        fingerprint: lessonReviewRecoveryFingerprint(recovery.outcome),
        activeObject: recovery.outcome.status === "status_unavailable"
          ? null
          : {
              kind: "recording",
              objectId: lessonId,
              version: ACTIVE_OBJECT_CURRENT_VERSION,
            },
      };
      queueLessonReviewHandoff(handoff);
      return;
    }

    setLessonRecoveryBusy(true);
    setLessonRecoveryError(null);
    lessonRecoveryRefreshRef.current += 1;
    try {
      if (action === "dismiss") {
        await forgetTrackedLessonReview(familyId, lessonId);
        setHiddenLessonReviewStates((current) => new Map(current).set(
          lessonId,
          lessonReviewRecoveryFingerprint(recovery.outcome),
        ));
        setTrackedLessonReviews((current) =>
          current.filter((item) => item.lesson.lessonId !== lessonId));
        return;
      }

      const result = await retryNativeLessonReview(lessonId);
      if (result.status === "request_failed") {
        setLessonRecoveryError(result.reason);
        return;
      }
      setTrackedLessonReviews((current) =>
        current.map((item) => item.lesson.lessonId === lessonId
          ? { ...item, outcome: result }
          : item));
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-voice",
        operation: `lesson-review-${action}`,
      });
      setLessonRecoveryError(
        action === "retry"
          ? "Homa could not confirm another review started. The lesson is still saved. Try again when your connection is ready."
          : "Homa could not dismiss this review yet. Please try again.",
      );
    } finally {
      setLessonRecoveryBusy(false);
    }
  }

  const primaryAction = session.turnActive
    ? session.toggleMute
    : session.status === "paused"
      ? session.resume
      : session.failed
        ? session.retry
        : session.start;
  const primaryLabel = session.turnActive
    ? session.muted
      ? "Unmute"
      : "Mute"
    : session.status === "paused"
      ? "Resume conversation"
      : session.failed
        ? "Try again"
        : "Talk to Homa";

  if (activeLessonRecorder && family?.id) {
    return (
      <NativeLessonRecorder
        familyId={family.id}
        intent={activeLessonRecorder}
        onCancel={() => {
          setActiveLessonRecorder(null);
          session.resume();
        }}
        onResumeVoice={(prompt, reviewedLessonId) => {
          setActiveLessonRecorder(null);
          if (prompt && reviewedLessonId && family?.id) {
            queueLessonReviewHandoff({
              familyId: family.id,
              lessonId: reviewedLessonId,
              prompt,
              fingerprint: "ready",
              activeObject: {
                kind: "recording",
                objectId: reviewedLessonId,
                version: ACTIVE_OBJECT_CURRENT_VERSION,
              },
            });
          } else {
            if (prompt) lessonResumePromptRef.current = prompt;
            session.resume();
          }
          void refreshTrackedLessonReviews();
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                session.turnActive
                  ? "End voice conversation"
                  : session.status === "paused"
                    ? "Resume voice conversation"
                    : "Start talking with Homa"
              }
              onPress={
                session.turnActive
                  ? session.end
                  : session.status === "paused"
                    ? session.resume
                    : session.start
              }
              hitSlop={20}
            >
              <HomaCharacter
                state={characterState}
                size={CHARACTER_SIZE}
                audioLevel={session.assistantAudioLevel}
              />
            </Pressable>
          </View>
          {statusText ? (
            <Text style={{ marginTop: -space.xl, fontFamily: fontFamilies.body, fontSize: fontSize.base, color: dark ? darkColors.textMuted : colors.textMuted, textAlign: "center" }}>
              {statusText}
            </Text>
          ) : null}
        </Animated.View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
          showsVerticalScrollIndicator={false}
        >
          {recoveryVisible && activeLessonRecovery ? (
            <LessonReviewRecoveryCard
              item={activeLessonRecovery}
              dark={dark}
              busy={lessonRecoveryBusy}
              error={lessonRecoveryError}
              onAction={(action) => void handleLessonRecoveryAction(action)}
            />
          ) : null}
          <VoicePromptStarters
            visible={startersVisible}
            tone={dark ? "dark" : "light"}
            onPick={handlePromptStarter}
          />
          <TranscriptRibbon
            userText={session.turnActive && !session.assistantTextStreaming ? session.lastUserText : null}
            assistantText={session.turnActive && !session.assistantTextStreaming ? null : session.lastAssistantText}
            failed={session.failed}
            onRetry={session.retry}
            onPressReply={() => setReplyOpen(true)}
            tone={dark ? "dark" : "light"}
          />
        </ScrollView>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.md) }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use text chat"
          onPress={leaveVoice}
          hitSlop={8}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: controlFill, opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name="close" size={20} color={dark ? darkColors.textMuted : colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          onPress={primaryAction}
          style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: controlBorder, backgroundColor: controlFill }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            {session.muted || session.status === "paused"
              ? <Icon name="muted" size={16} color={controlText} />
              : <Icon name="voice" size={16} color={controlText} />}
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: controlText }}>
              {primaryLabel}
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
          if (action === "share") session.sendText("Share this through an app I choose.");
          if (action === "keep") session.sendText("I love it. Keep this one.");
          if (action === "change") session.sendText("I want to change this material.");
          if (action === "earlier") session.sendText("Show me the earlier version of this material.");
        }}
        onStateRecordOpen={openStateRecord}
        onStateRecordReady={(message) => session.announceResult(message)}
        printNotice={visiblePrintNotice}
        onReceiptPress={(signal) => {
          if (signal.toolName === "log_hours") {
            hoursKeyRef.current += 1;
            setOverlayModel((current) => applyOverlaySignal(current, { kind: "hours", key: `voice-hours-${hoursKeyRef.current}` }));
            return;
          }
          setOverlayModel((current) => dismissActiveOverlay(current));
        }}
        onUndoReceipt={(signal) => {
          if (!signal.actionReceipt) return;
          session.sendText(
            `Undo ${signal.actionReceipt.namedEffect}. Use action receipt ${signal.actionReceipt.id}.`,
          );
          setOverlayModel((current) => dismissActiveOverlay(current));
        }}
        float={(
          <HomaCharacter
            state={characterState}
            size={PUCK_SIZE}
            audioLevel={session.assistantAudioLevel}
          />
        )}
      />
    </View>
  );
}
