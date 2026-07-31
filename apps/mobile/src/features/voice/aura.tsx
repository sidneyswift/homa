import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { palette } from "../../theme/tokens";
import type { CharacterState } from "./character-state";

/**
 * The warmth behind the house: two layered soft radial glows in
 * sunshine gold that breathe out of sync with the character's bob.
 * Deliberately NOT a spinner and NOT an equalizer: no strokes, no arcs,
 * no bars, just light that swells when she is paying attention, dims
 * while she works, and pulses gently while she talks.
 *
 * Rendered behind the mark by HomaCharacter (homa-character.tsx); the
 * screen never mounts this on its own unless it wants a bare glow.
 * `size` is the character mark's size; the glow canvas is twice that,
 * centered on the same point.
 */

/** The state-change settle, cubic-bezier(0.22, 0.8, 0.28, 1). */
const SETTLE = Easing.bezier(0.22, 0.8, 0.28, 1);
const BREATHE = Easing.inOut(Easing.sin);
const SETTLE_MS = 280;

/** One ring's breathing band in a given state. */
interface Breath {
  scaleMin: number;
  scaleMax: number;
  opacityMin: number;
  opacityMax: number;
  /** Full in-and-out cycle, ms. Unrelated to the bob's ~1560ms on
   *  purpose, so the glow and the float never lock step. Speaking is
   *  the exception: a rhythmic 600-900ms pulse is the point. */
  period: number;
}

const INNER: Record<CharacterState, Breath> = {
  idle: { scaleMin: 1, scaleMax: 1.05, opacityMin: 0.3, opacityMax: 0.43, period: 2740 },
  listening: { scaleMin: 1.06, scaleMax: 1.12, opacityMin: 0.4, opacityMax: 0.52, period: 2320 },
  thinking: { scaleMin: 0.98, scaleMax: 1.03, opacityMin: 0.1, opacityMax: 0.18, period: 3660 },
  speaking: { scaleMin: 1.02, scaleMax: 1.1, opacityMin: 0.34, opacityMax: 0.52, period: 760 },
};

const OUTER: Record<CharacterState, Breath> = {
  idle: { scaleMin: 1, scaleMax: 1.06, opacityMin: 0.28, opacityMax: 0.4, period: 3460 },
  listening: { scaleMin: 1.05, scaleMax: 1.12, opacityMin: 0.36, opacityMax: 0.48, period: 2980 },
  thinking: { scaleMin: 0.98, scaleMax: 1.04, opacityMin: 0.08, opacityMax: 0.16, period: 4480 },
  speaking: { scaleMin: 1.02, scaleMax: 1.09, opacityMin: 0.3, opacityMax: 0.48, period: 840 },
};

/** Sunshine gold, the #FFD43B family the brand references use for the
 *  glow's core. No token export matches it (gold500 is deeper mustard),
 *  so the literal stays, per the voice-first bar doc. The outer wash is
 *  the token gold100. */
const INNER_GOLD = "#FFD43B";

function AuraRing({
  state,
  diameter,
  offset,
  color,
  gradientId,
  bands,
  stillOpacity,
  coreStop,
  midStop,
  midOffset,
}: {
  state: CharacterState;
  diameter: number;
  offset: number;
  color: string;
  gradientId: string;
  bands: Record<CharacterState, Breath>;
  /** What the ring holds at under reduced motion: a static aura, no loops. */
  stillOpacity: number;
  coreStop: number;
  midStop: number;
  midOffset: number;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(stillOpacity);

  useEffect(() => {
    if (reduced) {
      scale.value = 1;
      opacity.value = stillOpacity;
      return;
    }
    const band = bands[state];
    const half = band.period / 2;
    scale.value = withSequence(
      withTiming(band.scaleMin, { duration: SETTLE_MS, easing: SETTLE }),
      withRepeat(
        withSequence(
          withTiming(band.scaleMax, { duration: half, easing: BREATHE }),
          withTiming(band.scaleMin, { duration: half, easing: BREATHE }),
        ),
        -1,
      ),
    );
    opacity.value = withSequence(
      withTiming(band.opacityMin, { duration: SETTLE_MS, easing: SETTLE }),
      withRepeat(
        withSequence(
          withTiming(band.opacityMax, { duration: half, easing: BREATHE }),
          withTiming(band.opacityMin, { duration: half, easing: BREATHE }),
        ),
        -1,
      ),
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [state, reduced, bands, stillOpacity, scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const radius = diameter / 2;
  return (
    <Animated.View
      style={[
        { position: "absolute", left: offset, top: offset, width: diameter, height: diameter },
        ringStyle,
      ]}
    >
      <Svg width={diameter} height={diameter}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={coreStop} />
            <Stop offset={midOffset} stopColor={color} stopOpacity={midStop} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={radius} cy={radius} r={radius} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

export function Aura({ state, size }: { state: CharacterState; size: number }) {
  // Wide and slow: best-in-class orbs radiate into their field. The
  // outer wash reaches ~2.4x the mark so the glow blends into the
  // screen's own gold field instead of dying at the silhouette
  // (gauntlet critic round 1: "glow sticker on a blank page").
  const canvas = size * 2.6;
  const innerDiameter = size * 1.4;
  const outerDiameter = size * 2.4;

  return (
    <View
      pointerEvents="none"
      style={{ width: canvas, height: canvas }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AuraRing
        state={state}
        diameter={outerDiameter}
        offset={(canvas - outerDiameter) / 2}
        color={palette.gold100}
        gradientId="aura-outer"
        bands={OUTER}
        stillOpacity={0.3}
        coreStop={0.7}
        midStop={0.4}
        midOffset={0.68}
      />
      <AuraRing
        state={state}
        diameter={innerDiameter}
        offset={(canvas - innerDiameter) / 2}
        color={INNER_GOLD}
        gradientId="aura-inner"
        bands={INNER}
        stillOpacity={0.34}
        coreStop={0.85}
        midStop={0.4}
        midOffset={0.55}
      />
    </View>
  );
}
