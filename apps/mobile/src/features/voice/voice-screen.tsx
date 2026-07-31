import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { ArrowUp, X } from "lucide-react-native";

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
/** The gold aura field sits at ~1.6x the character. */
const AURA_SIZE = CHARACTER_SIZE * 1.6;
/** Dark-mode surface, the night navy from the voice-first design bar
 *  (docs reference: scratchpad voice-first-bar.md; splash twin). */
const NIGHT_NAVY = "#151B27";

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
          <Stop offset="42%" stopColor={palette.gold100} stopOpacity={0.35} />
          <Stop offset="70%" stopColor={palette.gold100} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#voiceAuraField)" opacity={0.4} />
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

  // Character placement: centered at ~55% of the visible field, and a
  // ~72px puck pinned top-center while a sheet is up. The field height
  // rides a shared value (updated on layout, so the keyboard opening
  // recenters the character smoothly) and the puck transition is a
  // single timed value; both respect the system reduce-motion setting.
  const fieldHeight = useSharedValue(0);
  const puck = useSharedValue(0);
  const topInset = insets.top;

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
    const normalCenter = fieldHeight.value * 0.55;
    const puckCenter = topInset + PUCK_SIZE / 2 + space.md;
    const scale = 1 + puck.value * (PUCK_SIZE / CHARACTER_SIZE - 1);
    return {
      opacity: 1,
      top: normalCenter - AURA_SIZE / 2,
      transform: [
        { translateY: puck.value * (puckCenter - normalCenter) },
        { scale },
      ],
    };
  });

  const surface = dark ? NIGHT_NAVY : colors.page;
  const inputBackground = dark ? palette.stone800 : colors.card;
  const inputBorder = dark ? palette.stone700 : colors.borderSubtle;
  const inputText = dark ? palette.stone50 : colors.textStrong;
  const inputPlaceholder = dark ? palette.stone400 : colors.textSubtle;
  const controlBackground = dark ? palette.stone800 : palette.stone100;
  const controlIcon = dark ? palette.stone100 : colors.textBody;

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
            <TranscriptRibbon
              userText={session.lastUserText}
              assistantText={session.lastAssistantText}
              failed={session.failed}
              onRetry={session.retry}
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
              backgroundColor: controlBackground,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <X size={18} color={controlIcon} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Talk to Homa"
            placeholderTextColor={inputPlaceholder}
            autoFocus
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={sendDraft}
            onFocus={() => setComposerFocused(true)}
            onBlur={() => setComposerFocused(false)}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: inputBorder,
              backgroundColor: inputBackground,
              paddingHorizontal: 20,
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: inputText,
            }}
          />
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
      <OverlayHost
        signal={activeSignal}
        onDismiss={() => setOverlayModel((current) => dismissActiveOverlay(current))}
      />
    </View>
  );
}
