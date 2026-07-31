import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { ArrowUp, Mic, X } from "lucide-react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
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
import { SuggestionChips } from "./suggestion-chips";
import { suggestionChipsVisible } from "./suggestion-chips-model";
import { TranscriptRibbon } from "./transcript-ribbon";
import { useVoiceSession } from "./use-voice-session";

/**
 * The voice-first surface: a quiet full-bleed field where the animated
 * Homa character is the whole interface. One central presence, near
 * zero chrome; state reads from the character's motion (homa-character
 * .tsx), not labels. The composer autofocuses on mount so the system
 * keyboard's dictation mic is one tap away: that keyboard IS the voice
 * input story this phase.
 *
 * When a tool call surfaces something worth seeing (overlay-model.ts),
 * the sheet slides up and the character shrinks to a small live puck
 * pinned top-center, still animating, so "you can keep talking" reads
 * visually. Motion transitions all pass ReduceMotion.System, and the
 * character stands its own loops down via useReducedMotion.
 */

const CHARACTER_SIZE = 240;
const PUCK_SIZE = 72;
/** The gold aura field radiates well past the mark (~2.4x) so the glow
 *  blends into the field instead of dying at the silhouette. */
const AURA_SIZE = CHARACTER_SIZE * 2.4;
/** Dark-mode surface, the night navy from the voice-first design bar
 *  (docs reference: scratchpad voice-first-bar.md; splash twin). */
const NIGHT_NAVY = "#151B27";

/** Translucent bottom-row fills: the composer and close button float on
 *  the gradient field instead of sitting on it as opaque chrome, which
 *  read as chat-first (critics round 1). Warm alphas over the tokens'
 *  opaque hex, the NIGHT_NAVY and scrim idiom. */
const COMPOSER_FILL_LIGHT = "rgba(255,255,255,0.72)";
const COMPOSER_FILL_DARK = "rgba(51,46,41,0.72)";
const CLOSE_FILL_LIGHT = "rgba(51,42,33,0.08)";
const CLOSE_FILL_DARK = "rgba(251,247,240,0.12)";

/** The soft gold radial glow behind the character: gold100 fading to
 *  transparent by 70%, whole field at ~0.4 opacity, per the splash's
 *  radial recipe. Static on purpose; the character's own aura breathes. */
function GoldAuraField({ size }: { size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ position: "absolute" }}
      pointerEvents="none"
    >
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

export function VoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === "dark";
  const session = useVoiceSession();
  const messages = session.messages;
  const [draft, setDraft] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const [overlayModel, setOverlayModel] =
    useState<OverlayModelState>(EMPTY_OVERLAY_MODEL);
  /** Once a turn has started this visit, the idle chips never return
   *  until the screen remounts (suggestion-chips-model.ts). */
  const [chipsRetired, setChipsRetired] = useState(false);
  /** The full-reply sheet is screen-local state, not an overlay signal:
   *  a tool overlay arriving while it is open wins (effect below). */
  const [replyOpen, setReplyOpen] = useState(false);
  /** Monotonic key source for synthetic hours signals (a receipt tap),
   *  a ref so no key is ever minted during render. */
  const hoursKeyRef = useRef(0);
  /** Signals already on the wire at mount never open a sheet; only what
   *  arrives during this visit does (overlay-model.ts's dedup idiom). */
  const handledKeysRef = useRef<Set<string> | null>(null);
  if (handledKeysRef.current === null) {
    handledKeysRef.current = new Set(
      deriveOverlaySignals([...messages], new Set()).keys,
    );
  }

  useEffect(() => {
    const handled = handledKeysRef.current;
    if (!handled) return;
    const { signals } = deriveOverlaySignals([...messages], handled);
    if (signals.length === 0) return;
    for (const signal of signals) handled.add(signal.key);
    setOverlayModel((current) =>
      signals.reduce(
        (state, signal) => applyOverlaySignal(state, signal),
        current,
      ),
    );
  }, [messages]);

  const activeSignal = overlayModel.active;
  // Receipts are toasts, not sheets; the character only shrinks to the
  // puck when a sheet actually covers the field.
  const overlayActive = activeSignal !== null && activeSignal.kind !== "receipt";

  // A turn starting retires the idle chips for the rest of the visit.
  // Guarded render-phase adjustment (the React "adjusting state when a
  // prop changes" idiom; the hooks lint bans setState inside effects).
  if (session.turnActive && !chipsRetired) setChipsRetired(true);

  // Overlay wins: a sheet-kind overlay activating closes the reply
  // sheet (both are Modals; the render guard below keeps them from ever
  // presenting together, this keeps the state honest so dismissing the
  // overlay does not resurrect the reply).
  if (overlayActive && replyOpen) setReplyOpen(false);

  const chipsVisible = suggestionChipsVisible({
    retired: chipsRetired,
    turnActive: session.turnActive,
    composerEmpty: draft.length === 0,
    overlayOpen: activeSignal !== null,
    assistantHasReplied: session.lastAssistantText !== null,
  });

  const characterState = deriveCharacterState({
    composerFocused,
    turnActive: session.turnActive,
    assistantTextStreaming: session.assistantTextStreaming,
  });

  // The single allowed status line: only while thinking or speaking,
  // never competing with an open sheet.
  const statusText = overlayActive
    ? null
    : characterState === "thinking"
      ? (session.busyDetail ?? "thinking about that")
      : characterState === "speaking"
        ? "speaking"
        : null;

  // Character placement: locked at ~43% of the visible field so text
  // length never pushes her around. While a sheet is up, this layer
  // fades out and the OverlayHost renders its own live puck ABOVE the
  // scrim (a fade handoff, not a shrink: the Modal is a separate native
  // layer, and a dimmed puck under the scrim reads as switched off).
  const fieldHeight = useSharedValue(0);
  const puck = useSharedValue(0);

  useEffect(() => {
    puck.value = withTiming(overlayActive ? 1 : 0, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [overlayActive, puck]);

  function handleFieldLayout(event: LayoutChangeEvent) {
    const height = event.nativeEvent.layout.height;
    if (fieldHeight.value === 0) {
      fieldHeight.value = height;
      return;
    }
    fieldHeight.value = withTiming(height, {
      duration: 260,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  }

  const characterLayerStyle = useAnimatedStyle(() => {
    if (fieldHeight.value === 0) return { opacity: 0 };
    const normalCenter = fieldHeight.value * 0.43;
    return {
      opacity: 1 - puck.value,
      top: normalCenter - AURA_SIZE / 2,
    };
  });

  const surface = dark ? NIGHT_NAVY : colors.page;
  const inputBackground = dark ? COMPOSER_FILL_DARK : COMPOSER_FILL_LIGHT;
  const inputBorder = dark ? palette.stone700 : colors.borderSubtle;
  const inputText = dark ? palette.stone50 : colors.textStrong;
  const inputPlaceholder = dark ? palette.stone400 : colors.textSubtle;
  const closeBackground = dark ? CLOSE_FILL_DARK : CLOSE_FILL_LIGHT;
  const closeIcon = dark ? palette.stone300 : colors.textMuted;
  const micTint = dark ? palette.stone400 : colors.textSubtle;

  function sendDraft() {
    const text = draft.trim();
    if (text.length === 0) return;
    session.send(text);
    setDraft("");
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1 }} onLayout={handleFieldLayout}>
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", left: 0, right: 0, alignItems: "center" },
              characterLayerStyle,
            ]}
          >
            <View
              style={{
                width: AURA_SIZE,
                height: AURA_SIZE,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GoldAuraField size={AURA_SIZE} />
              <HomaCharacter state={characterState} size={CHARACTER_SIZE} />
            </View>
            {statusText ? (
              <Text
                style={{
                  marginTop: -space.xl,
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.base,
                  color: dark ? palette.stone300 : colors.textMuted,
                  textAlign: "center",
                }}
              >
                {statusText}
              </Text>
            ) : null}
          </Animated.View>

          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            {/* The idle whisper: chat's opening prompts floating just
                above the ribbon while nothing else is happening. They
                fade the moment a turn starts and stay gone (the retire
                latch above) until the screen remounts. */}
            <SuggestionChips
              visible={chipsVisible}
              tone={dark ? "dark" : "light"}
              onPick={session.send}
            />
            {/* One voice at a time: while a turn is in flight only the
                parent's quote shows (the old answer fading with it would
                read as answering the new question); once the reply
                streams, it takes the ribbon alone. */}
            <TranscriptRibbon
              userText={
                session.turnActive && !session.assistantTextStreaming
                  ? session.lastUserText
                  : null
              }
              assistantText={
                session.turnActive && !session.assistantTextStreaming
                  ? null
                  : session.lastAssistantText
              }
              failed={session.failed}
              onRetry={session.retry}
              onPressReply={() => setReplyOpen(true)}
              tone={dark ? "dark" : "light"}
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            paddingHorizontal: space.md,
            paddingTop: space.sm,
            paddingBottom: Math.max(insets.bottom, space.md),
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: closeBackground,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <X size={18} color={closeIcon} />
          </Pressable>
          {/* The pill stays a real TextInput because iOS only reaches
              dictation through the keyboard mic; the small muted glyph
              inside is a quiet promise of voice, decorative on purpose
              (taps pass through to the input beneath it). */}
          <View
            style={{
              flex: 1,
              minHeight: 48,
              justifyContent: "center",
              borderRadius: radius.pill,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: inputBorder,
              backgroundColor: inputBackground,
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: space.md,
                top: 0,
                bottom: 0,
                justifyContent: "center",
              }}
            >
              <Mic size={16} color={micTint} />
            </View>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Talk to Homa"
              placeholderTextColor={inputPlaceholder}
              autoFocus
              returnKeyType="send"
              submitBehavior="submit"
              selectionColor={colors.brand}
              onSubmitEditing={sendDraft}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              style={{
                minHeight: 48,
                paddingLeft: space.md + 16 + space.sm,
                paddingRight: 20,
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: inputText,
              }}
            />
          </View>
          {draft.trim().length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              onPress={sendDraft}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.brandHover : colors.brand,
              })}
            >
              <ArrowUp size={18} color={colors.onBrand} />
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      {/* Screen-local, never an overlay signal: the render guard plus
          the overlay-wins effect above keep this Modal and the overlay
          sheet's from ever presenting together. */}
      {replyOpen && !overlayActive && session.lastAssistantText ? (
        <ReplySheet
          text={session.lastAssistantText}
          onDismiss={() => setReplyOpen(false)}
        />
      ) : null}
      <OverlayHost
        signal={activeSignal}
        onDismiss={() => setOverlayModel((current) => dismissActiveOverlay(current))}
        onAnswer={(message) => {
          // Dismiss first, then send: the answer becomes a real user
          // turn and the character passes through thinking naturally.
          setOverlayModel((current) => dismissActiveOverlay(current));
          session.send(message);
        }}
        onReceiptPress={(signal) => {
          // An hours receipt opens the hours sheet in its place; any
          // other receipt tap just dismisses the toast. The synthetic
          // key comes from a counter ref, never minted during render.
          if (signal.toolName === "log_hours") {
            hoursKeyRef.current += 1;
            const key = `voice-hours-${hoursKeyRef.current}`;
            setOverlayModel((current) =>
              applyOverlaySignal(current, { kind: "hours", key }),
            );
            return;
          }
          setOverlayModel((current) => dismissActiveOverlay(current));
        }}
        float={<HomaCharacter state={characterState} size={PUCK_SIZE} />}
      />
    </View>
  );
}
