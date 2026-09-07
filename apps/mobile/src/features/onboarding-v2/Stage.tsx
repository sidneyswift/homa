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
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { HomaCharacter } from "../voice/homa-character";
import type { CharacterState } from "../voice/character-state";
import { NativeText } from "../../components/ui/semantic";
import { v2Colors, v2Radii, v2Space, v2Type } from "./theme";

export const SETTLE = Easing.bezier(0.22, 0.8, 0.28, 1);
export const SETTLE_MS = 350;
export const BUBBLE_MS = 240;

export type Posture = "big" | "docked";

const BIG_SIZE = 132;
const DOCKED_SIZE = 44;

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
 * never changes mid-transition (the same rule signin.tsx's hero follows). */
export function Mascot({ posture, characterState = "idle" }: { posture: Posture; characterState?: CharacterState }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(posture === "big" ? 1 : DOCKED_SIZE / BIG_SIZE);

  useEffect(() => {
    const target = posture === "big" ? 1 : DOCKED_SIZE / BIG_SIZE;
    scale.value = reducedMotion ? target : withTiming(target, { duration: SETTLE_MS, easing: SETTLE });
  }, [posture, reducedMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <HomaCharacter state={characterState} size={BIG_SIZE} act={null} />
    </Animated.View>
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
            : { left: -7, top: 18, borderColor: v2Colors.border, borderTopWidth: 0, borderLeftWidth: 0 },
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
  children?: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}

/** The composed screen shell. Every onboarding v2 route renders this once. */
export function OnboardingStage({
  posture,
  progress = 0,
  bubble,
  bubbleTail = "up",
  bubbleKey,
  onBack,
  characterState = "idle",
  heroPaddingTop = 32,
  children,
  footer,
  scroll = true,
}: OnboardingStageProps) {
  // The footer is a fixed sibling below the ScrollView, not inside it, so
  // tall content plus a tall footer (a multi-line paywall, say) can leave
  // the ScrollView's own max-scroll short of clearing it: the last bit of
  // content stays permanently hidden behind the footer. Measuring the
  // footer's real height and feeding it back as scroll padding is the fix.
  const [footerHeight, setFooterHeight] = useState(0);

  const inner = (
    <>
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
              <DockedProgressBar progress={progress} />
            </View>
          </View>
        </View>
      ) : null}

      <View
        style={{
          paddingHorizontal: v2Space.lg,
          paddingTop: posture === "big" ? heroPaddingTop : v2Space.md,
          flexDirection: posture === "docked" ? "row" : "column",
          alignItems: posture === "docked" ? "flex-start" : "center",
          gap: v2Space.md,
        }}
      >
        <Mascot posture={posture} characterState={characterState} />
        <View style={{ flex: posture === "docked" ? 1 : undefined, alignItems: posture === "docked" ? "flex-start" : "center" }}>
          <Bubble tail={bubbleTail} bubbleKey={bubbleKey}>
            {bubble}
          </Bubble>
        </View>
      </View>

      <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.lg, flex: 1 }}>{children}</View>
    </>
  );

  return (
    <SafeAreaView edges={posture === "big" ? ["bottom"] : ["top", "bottom"]} style={{ flex: 1, backgroundColor: v2Colors.page }}>
      {posture === "big" ? <Sky height={260} /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: v2Space.xl + footerHeight }}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
      {footer ? (
        <View
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          style={{ paddingHorizontal: v2Space.lg, paddingBottom: v2Space.md }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
