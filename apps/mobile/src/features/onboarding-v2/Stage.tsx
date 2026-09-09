/**
 * The recurring shell every onboarding v2 screen sits inside: Homa in one
 * of two postures, a bubble that grows in beside her, and a docked
 * progress bar once the walk has moved past Hello.
 *
 * Posture is deliberately binary and set once per screen render, not a
 * continuously reverting size hook: "big" (centered, no chrome, Hello and
 * the payoff) and "docked" (small, top-left, every question screen). The
 * shrink-and-dock transition plays exactly once, driven by Hello itself
 * changing posture from "big" to "docked" after its third bubble.
 *
 * Simplification, stated plainly: the council review's motion spec asks
 * for pixel transformOrigin anchored at Homa's literal base and the
 * bubble's literal tail tip, measured via onLayout. This build uses
 * Reanimated's LinearTransition for the position move and a centered
 * scale for the grow-in instead of measured anchor points, which reads as
 * the same shrink-and-dock and grow-in feeling without the measurement
 * plumbing. Close the gap at graduation if the felt difference matters.
 */
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { HomaCharacter } from "../voice/homa-character";
import type { CharacterState } from "../voice/character-state";
import { NativeText } from "../../components/ui/semantic";
import { useOnboardingV2 } from "./state";
import { v2Colors, v2Radii, v2Space, v2Type } from "./theme";

export const SETTLE = Easing.bezier(0.22, 0.8, 0.28, 1);
export const SETTLE_MS = 350;
export const BUBBLE_MS = 240;

/**
 * "plain" is a third posture, not a docked/big variant: no mascot, no
 * speech bubble, just a plain heading. Measured off the real Keiki
 * reference (12 screens read directly, 2026-09-07): Didi is on-screen for
 * every conversational or data-collection moment, and gone specifically
 * for evidence and transactional screens, an outcome chart, science
 * citations, the account form, the paywall. Use "plain" for that
 * category; it is not a style choice, it is what the reference actually
 * does.
 */
export type Posture = "big" | "docked" | "plain";

const BIG_SIZE = 132;
// Measured against the real Keiki reference, 2026-09-07: their docked
// character runs about 20% of screen width; 44 was about 11%. 80 targets
// that same proportion on a typical iPhone width instead of guessing.
const DOCKED_SIZE = 80;

export type MascotGesture = "wave";

/**
 * A temporary limb, not a body (founder ruling 2026-09-07: "no body on the
 * guy... it should just have arms that come out of itself when necessary,
 * not all the time, but it should just be the logo"). One arm emerges from
 * the shape's side for a specific moment and retracts, the same additive
 * pattern the real production rig already uses for its drawing act (a
 * crayon appears in her hand for that one moment, never a permanent
 * redesign of the mark). Real rotation, not swapped frames: smoother than
 * a sprite sheet, and it can never drift from the mark's own fill color
 * because it IS the mark's fill color, not an approximation of it.
 */
function WaveArm({ size, play }: { size: number; play: boolean }) {
  const reducedMotion = useReducedMotion();
  const unit = size / 48;
  const rotate = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!play) {
      opacity.value = 0;
      rotate.value = -100;
      return;
    }
    if (reducedMotion) {
      opacity.value = 1;
      rotate.value = -20;
      return;
    }
    opacity.value = withSequence(
      withTiming(1, { duration: 160, easing: SETTLE }),
      withTiming(1, { duration: 900 }),
      withTiming(0, { duration: 260, easing: SETTLE }),
    );
    rotate.value = withSequence(
      withTiming(-15, { duration: 340, easing: SETTLE }),
      withTiming(-32, { duration: 160 }),
      withTiming(-4, { duration: 190 }),
      withTiming(-28, { duration: 170 }),
      withTiming(-15, { duration: 190 }),
      withTiming(-100, { duration: 300, easing: SETTLE }),
    );
  }, [play, reducedMotion, opacity, rotate]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const armWidth = 9 * unit;
  const armHeight = 22 * unit;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: size * 0.76,
          top: size * 0.4,
          width: armWidth,
          height: armHeight,
          // Pixel values, not a percentage string: percentage transformOrigin
          // on an Animated.View silently blanks the whole subtree on Fabric
          // (the same Fabric gotcha the real homa-character.tsx rig documents
          // for its own base-anchored transforms).
          transformOrigin: [armWidth / 2, 2 * unit, 0],
        },
        style,
      ]}
    >
      <Svg width={armWidth} height={armHeight} viewBox="0 0 9 22">
        <Path
          d="M4.5 0 C7 0 9 2 9 4.5 L9 17.5 C9 20 7 22 4.5 22 C2 22 0 20 0 17.5 L0 4.5 C0 2 2 0 4.5 0 Z"
          fill={v2Colors.coral}
        />
      </Svg>
    </Animated.View>
  );
}

/** Full-width gradient sky behind the big posture only, ported from the
 * merged sign-in hero (apps/mobile/src/app/(auth)/signin.tsx) so Hello and
 * the payoff share one warm identity. */
function Sky({ height }: { height: number }) {
  return (
    <Svg pointerEvents="none" width="100%" height={height} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id="v2sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={v2Colors.field} />
          <Stop offset="0.5" stopColor={v2Colors.fieldMid} />
          <Stop offset="1" stopColor={v2Colors.page} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#v2sky)" />
    </Svg>
  );
}

/** Homa herself, one size driven by an outer scale wrapper so
 * HomaCharacter's own `size` prop, which bakes into internal SVG math,
 * never changes mid-transition (the same rule signin.tsx's hero follows).
 *
 * `entrance`: a one-time pop-in for the very first reveal (Hello only),
 * separate from the posture-driven scale above it: starts small, settles
 * past 1 and back, so the mascot's first appearance reads as an arrival,
 * not just "the screen mounted with an image already on it". */
export function Mascot({
  posture,
  characterState = "idle",
  entrance = false,
  gesture,
  compact = false,
}: {
  posture: Posture;
  characterState?: CharacterState;
  entrance?: boolean;
  /** A temporary arm accessory for one specific beat, never a standing
   * pose (see WaveArm's own docstring). Undefined/falsy: no arm at all. */
  gesture?: MascotGesture | null;
  compact?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const postureScale = useSharedValue(posture === "big" ? 1 : DOCKED_SIZE / BIG_SIZE);
  const entranceScale = useSharedValue(entrance && !reducedMotion ? 0.4 : 1);

  useEffect(() => {
    const target = posture === "big" ? 1 : DOCKED_SIZE / BIG_SIZE;
    postureScale.value = reducedMotion ? target : withTiming(target, { duration: SETTLE_MS, easing: SETTLE });
  }, [posture, reducedMotion, postureScale]);

  useEffect(() => {
    if (!entrance || reducedMotion) return;
    entranceScale.value = withSequence(
      withTiming(1.08, { duration: 420, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: SETTLE }),
    );
    // `entrance` is a fixed prop for the screen's whole lifetime (Hello
    // always passes true), so in practice this fires exactly once, on
    // mount; it isn't keyed to characterState or posture.
  }, [entrance, reducedMotion, entranceScale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: postureScale.value * entranceScale.value }],
  }));

  const size = compact && posture === "docked" ? DOCKED_SIZE : BIG_SIZE;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ width: BIG_SIZE, height: BIG_SIZE }, style]}>
        <HomaCharacter state={characterState} size={BIG_SIZE} act={null} />
        <WaveArm size={BIG_SIZE} play={gesture === "wave"} />
      </Animated.View>
    </View>
  );
}

/** The speech bubble. Grows in on mount, and again on every `bubbleKey`
 * change (a swap), scale 0.6->1 plus opacity, matching the council
 * review's grow-in spec minus the tail-anchored transformOrigin. */
export function Bubble({
  children,
  tail = "up",
  bubbleKey,
}: {
  children: React.ReactNode;
  tail?: "up" | "left";
  bubbleKey: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <Animated.View
      key={bubbleKey}
      entering={
        reducedMotion
          ? FadeIn.duration(120)
          : FadeIn.duration(BUBBLE_MS)
              .easing(SETTLE)
              .withInitialValues({ transform: [{ scale: 0.6 }] })
      }
      layout={LinearTransition.duration(200)}
      style={[
        {
          backgroundColor: v2Colors.paper,
          borderRadius: v2Radii.bubble,
          borderWidth: 1,
          borderColor: v2Colors.border,
          padding: v2Space.md,
          maxWidth: 340,
        },
        tail === "up" ? styles.tailUp : styles.tailLeft,
      ]}
    >
      {typeof children === "string" ? (
        <NativeText style={[v2Type.question, { color: v2Colors.ink }]}>{children}</NativeText>
      ) : (
        children
      )}
      <View
        style={[
          styles.tail,
          tail === "up"
            ? { top: -7, left: 28, borderColor: v2Colors.border, borderBottomWidth: 0, borderRightWidth: 0 }
            : { left: -7, top: "50%", marginTop: -7, borderColor: v2Colors.border, borderTopWidth: 0, borderRightWidth: 0 },
        ]}
      />
    </Animated.View>
  );
}

const styles: Record<string, ViewStyle> = {
  tail: {
    position: "absolute",
    width: 14,
    height: 14,
    backgroundColor: v2Colors.paper,
    borderWidth: 1,
    transform: [{ rotate: "45deg" }],
  },
};

function DockedProgressBar({ progress }: { progress: number }) {
  const width = useSharedValue(progress);
  useEffect(() => {
    width.value = withTiming(progress, { duration: 300, easing: SETTLE });
  }, [progress, width]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(4, width.value * 100)}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={{
        height: 6,
        borderRadius: v2Radii.pill,
        backgroundColor: v2Colors.border,
        overflow: "hidden",
      }}
    >
      <Animated.View style={[{ height: "100%", backgroundColor: v2Colors.coral, borderRadius: v2Radii.pill }, style]} />
    </View>
  );
}

/**
 * The lab's version of the real onboarding walk's floating restart pill
 * ((onboarding)/_layout.tsx's DevRestartWalk, dev-only there since it
 * touches a real family's server-side row; this lab has only in-memory
 * state, so it can stay on unconditionally). Rendered in normal layout
 * flow, not absolutely positioned: a fixed pixel offset could not clear
 * all three postures' different header heights at once without
 * overlapping one of them (found live, 2026-09-07, on the plain-posture
 * paywall). Taking real space instead means it can never collide.
 */
function RestartLabRow({ posture }: { posture: Posture }) {
  const router = useRouter();
  const { reset } = useOnboardingV2();
  // Big posture's SafeAreaView deliberately skips the top edge (the sky
  // bleeds under the status bar), so this row has no inherited top inset
  // there the way docked/plain get for free. Add the real inset by hand
  // only in that case, or the pill renders straight under the status bar.
  const insets = useSafeAreaInsets();
  const extraTop = posture === "big" ? insets.top : 0;
  return (
    <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.sm + extraTop, alignItems: "flex-start" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Restart the onboarding v2 lab"
        onPress={() => {
          reset();
          router.replace("/labs/onboarding-v2");
        }}
        style={{
          paddingHorizontal: v2Space.sm,
          paddingVertical: 4,
          borderRadius: v2Radii.pill,
          borderWidth: 1,
          borderColor: v2Colors.border,
          backgroundColor: v2Colors.paper,
          opacity: 0.85,
        }}
      >
        <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>↺ restart lab</NativeText>
      </Pressable>
    </View>
  );
}

export interface OnboardingStageProps {
  posture: Posture;
  /** 0..1, docked posture only. Segmented by phase, never by subject. */
  progress?: number;
  bubble: React.ReactNode;
  bubbleTail?: "up" | "left";
  bubbleKey: string;
  onBack?: () => void;
  /** What Homa is doing while this screen is up: "listening" while she's
   * waiting on an answer, "thinking" while something is being built,
   * "speaking" for a payoff beat she's narrating. Defaults to "idle". */
  characterState?: CharacterState;
  /** Big posture only: extra top offset that centers the mascot+bubble
   * cluster lower on screen, matching the reference's low-content greeting
   * moments (bubble top ~30% down, character centered ~45%) instead of
   * pinning it under the status bar. Only safe when there's little else
   * below it to compete for space: Hello and the closing screen opt in
   * explicitly. Content-heavy big screens (a report, a paywall's pricing
   * cards) keep the default, or their cards get pushed into the footer. */
  heroPaddingTop?: number;
  /** Plays a one-time pop-in on the mascot when this screen mounts.
   * Hello only: the reference has a distinct arrival moment on its
   * welcome screen that every other screen deliberately skips. */
  entrance?: boolean;
  /** A temporary arm accessory for one specific beat, not a standing pose.
   * See WaveArm's own docstring for why this stays an accessory rather
   * than a body redesign. */
  gesture?: MascotGesture | null;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  /** Compact form layout: reserve the mascot's visible size and keep the footer above the keyboard. */
  compact?: boolean;
  /** Name the current phase without presenting an estimated completion percentage. */
  progressLabel?: string;
  showLabControls?: boolean;
}

/** The composed screen shell. Every onboarding v2 route renders this once. */
export function OnboardingStage({
  posture,
  progress = 0,
  bubble,
  bubbleTail = posture === "docked" ? "left" : "up",
  bubbleKey,
  onBack,
  characterState = "idle",
  heroPaddingTop = 32,
  entrance = false,
  gesture = null,
  children,
  footer,
  scroll = true,
  compact = posture !== "big",
  progressLabel,
  showLabControls = false,
}: OnboardingStageProps) {
  // The footer is a fixed sibling below the ScrollView, not inside it, so
  // tall content plus a tall footer (a multi-line paywall, say) can leave
  // the ScrollView's own max-scroll short of clearing it: the last bit of
  // content stays permanently hidden behind the footer. Measuring the
  // footer's real height and feeding it back as scroll padding is the fix.
  const [footerHeight, setFooterHeight] = useState(0);

  const inner = (
    <>
      {showLabControls ? <RestartLabRow posture={posture} /> : null}
      {posture === "docked" ? (
        <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.sm, gap: v2Space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {onBack ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12}>
                <NativeText style={{ color: v2Colors.coral, fontFamily: v2Type.control.fontFamily }}>Back</NativeText>
              </Pressable>
            ) : (
              <View style={{ width: 40 }} />
            )}
            <View style={{ flex: 1, marginLeft: v2Space.md }}>
              {progressLabel ? (
                <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted, textAlign: "right" }]}>{progressLabel}</NativeText>
              ) : <DockedProgressBar progress={progress} />}
            </View>
          </View>
        </View>
      ) : posture === "plain" && onBack ? (
        <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.sm }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12}>
            <NativeText style={{ color: v2Colors.coral, fontFamily: v2Type.control.fontFamily }}>Back</NativeText>
          </Pressable>
        </View>
      ) : null}

      {posture === "plain" ? (
        <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.lg }}>
          {typeof bubble === "string" ? (
            <NativeText style={[v2Type.hero, { color: v2Colors.ink, textAlign: "center" }]}>{bubble}</NativeText>
          ) : (
            bubble
          )}
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: v2Space.lg,
            paddingTop: posture === "big" ? heroPaddingTop : v2Space.md,
            flexDirection: posture === "docked" ? "row" : "column",
            alignItems: posture === "docked" && !compact ? "flex-start" : "center",
            gap: v2Space.md,
          }}
        >
          <Mascot posture={posture} characterState={characterState} entrance={entrance} gesture={gesture} compact={compact} />
          <View style={{ flex: posture === "docked" ? 1 : undefined, alignItems: posture === "docked" ? "flex-start" : "center" }}>
            <Bubble tail={bubbleTail} bubbleKey={bubbleKey}>
              {bubble}
            </Bubble>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.lg, flex: 1 }}>{children}</View>
    </>
  );

  return (
    <SafeAreaView edges={posture === "big" ? ["bottom"] : ["top", "bottom"]} style={{ flex: 1, backgroundColor: v2Colors.page }}>
      {posture === "big" ? <Sky height={260} /> : null}
      <KeyboardAvoidingView enabled={compact} behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: compact ? v2Space.lg : v2Space.xl + footerHeight }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {inner}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{inner}</View>
        )}
        {footer ? (
          <View
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.sm, paddingBottom: v2Space.md }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
