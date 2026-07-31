import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";

import {
  EYES,
  HOUSE_BASE,
  HOUSE_PATH,
  PUPIL_FILL,
} from "../../components/brand/logo";
import { colors, shadows } from "../../theme/tokens";
import { Aura } from "./aura";
import type { CharacterState } from "./character-state";

/**
 * The little home, alive on the voice screen. The same art as `Logo`
 * (imported, never redrawn: the mark is the mark, brand-casing-homa
 * 2026-07-28), the reanimated port of the web ThinkingMark rig
 * (apps/web/components/brand/ThinkingMark.tsx): nested wrappers each
 * owning ONE transform, ambient loops at deliberately unrelated
 * durations so the combination never visibly repeats.
 *
 * The rig, outside in:
 *
 *   lean    rocks on its feet, slow, own cycle       Animated.View
 *   pop     gentle swells, grown from the base       Animated.View
 *   bob     the breath, up and down (plus the dip)   Animated.View
 *   squish  squash and stretch, scaled from the base Animated.View
 *   lid     each eye's clay eyelid, per eye          AnimatedRect
 *   pupil   the gaze, both pupils tracking together  AnimatedCircle
 *
 * Body transforms live on RN views (guaranteed reanimated support,
 * transform-only, GPU friendly); only the pieces inside the SVG (lids
 * and pupils) animate SVG props, and only props of the Circle/Rect
 * length family that reanimated animates reliably on Fabric.
 *
 * No mouth, ever. No bounce (squash-and-bounce belongs to the splash
 * screen). Under reduced motion no loop ever starts: the still mark
 * with a static aura is the whole show.
 *
 * The screen mounts this one component; the aura renders behind the
 * mark in here.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** The state-change settle, cubic-bezier(0.22, 0.8, 0.28, 1). */
const SETTLE = Easing.bezier(0.22, 0.8, 0.28, 1);
const BREATHE = Easing.inOut(Easing.sin);
const SETTLE_MS = 280;

/** Everything scales from where the house meets the ground, like clay
 *  pressed down rather than a balloon. Pixel values, not a percentage
 *  string: percentage transformOrigin on an Animated.View silently
 *  blanks the whole subtree on Fabric (found live, 2026-07-31). */
function baseOrigin(size: number): [number, number, number] {
  return [(HOUSE_BASE.x / 48) * size, (HOUSE_BASE.y / 48) * size, 0];
}

/**
 * The breath, per state, in viewBox units (amp) and ms. Rise, hang,
 * rest: up quickly-ish, drift at the top, settle back down. Idle sums
 * to ~1560ms; thinking slows right down so a silent 60-90s tool call
 * reads as patient work, not a freeze.
 */
const BOB: Record<
  CharacterState,
  { amp: number; rise: number; hang: number; rest: number }
> = {
  idle: { amp: 1.7, rise: 590, hang: 340, rest: 630 },
  listening: { amp: 1.5, rise: 560, hang: 330, rest: 590 },
  thinking: { amp: 1.15, rise: 890, hang: 520, rest: 930 },
  speaking: { amp: 1.5, rise: 550, hang: 320, rest: 570 },
};

/**
 * Posture, per state: how wide the pupils are, where the gaze rests on
 * top of the ambient drift, and how far she settles toward the composer
 * (the dip, viewBox units). Listening leans toward the bottom of the
 * screen with widened pupils; thinking drifts the gaze up. Offsets are
 * clamped so the widest pupil at the farthest drift stays inside the
 * white (white r 4.8, pupil r 2.2, resting offset already 0.9, 0.7).
 */
const POSTURE: Record<
  CharacterState,
  { pupilScale: number; gazeBiasX: number; gazeBiasY: number; dip: number }
> = {
  idle: { pupilScale: 1, gazeBiasX: 0, gazeBiasY: 0, dip: 0 },
  listening: { pupilScale: 1.18, gazeBiasX: 0, gazeBiasY: 0.3, dip: 0.5 },
  thinking: { pupilScale: 1, gazeBiasX: 0, gazeBiasY: -0.8, dip: 0 },
  speaking: { pupilScale: 1.06, gazeBiasX: 0, gazeBiasY: 0, dip: 0 },
};

/** Move-and-hold waypoints for the wandering gaze, viewBox units. The
 *  whole tour runs ~10.5s, unrelated to every other loop on purpose. */
const GAZE_TOUR: readonly {
  x: number;
  y: number;
  move: number;
  hold: number;
}[] = [
  { x: 0.8, y: 0.25, move: 420, hold: 1640 },
  { x: -0.7, y: -0.2, move: 460, hold: 2380 },
  { x: 0.3, y: 0.4, move: 380, hold: 1460 },
  { x: 0, y: 0, move: 420, hold: 3310 },
];

function gazeSequence(pick: (waypoint: { x: number; y: number }) => number) {
  return withRepeat(
    withSequence(
      ...GAZE_TOUR.flatMap((waypoint) => [
        withTiming(pick(waypoint), { duration: waypoint.move, easing: SETTLE }),
        withTiming(pick(waypoint), { duration: waypoint.hold }),
      ]),
    ),
    -1,
  );
}

/** One uneven blink cycle: a single blink, a long open stretch, then a
 *  quick double, ~80ms shut each. Period ~6.5s, coprime with the rest. */
function blinkSequence() {
  const shut = { duration: 80, easing: Easing.in(Easing.quad) };
  const open = { duration: 120, easing: Easing.out(Easing.quad) };
  return withRepeat(
    withSequence(
      withTiming(0, { duration: 2140 }),
      withTiming(1, shut),
      withTiming(0, open),
      withTiming(0, { duration: 3690 }),
      withTiming(1, { duration: 70, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 90 }),
      withTiming(1, shut),
      withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }),
    ),
    -1,
  );
}

/**
 * One eye: the white, the tracking pupil, and a clay eyelid that slides
 * down inside a circular clip when `blink` closes. The lid is a Rect
 * with an animated `y` rather than the web rig's group scaleY because
 * group transform props are not reliably animatable through reanimated
 * on Fabric; Circle and Rect length props are.
 */
function CharacterEye({
  eye,
  blink,
  gazeX,
  gazeY,
  pupilScale,
  lidFill,
}: {
  eye: (typeof EYES)[number];
  blink: SharedValue<number>;
  gazeX: SharedValue<number>;
  gazeY: SharedValue<number>;
  pupilScale: SharedValue<number>;
  lidFill: string;
}) {
  const lidTravel = eye.r * 2 + 1;
  const lidTop = eye.cy - eye.r - 0.5;
  const lidProps = useAnimatedProps(() => ({
    y: lidTop - lidTravel + blink.value * lidTravel,
  }));
  const pupilProps = useAnimatedProps(() => ({
    cx: eye.pupilCx + gazeX.value,
    cy: eye.pupilCy + gazeY.value,
    r: eye.pupilR * pupilScale.value,
  }));
  const clipId = `voice-lid-${eye.cx}`;
  return (
    <>
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={eye.cx} cy={eye.cy} r={eye.r + 0.2} />
        </ClipPath>
      </Defs>
      <Circle cx={eye.cx} cy={eye.cy} r={eye.r} fill="#FFFFFF" />
      <AnimatedCircle animatedProps={pupilProps} fill={PUPIL_FILL} />
      <G clipPath={`url(#${clipId})`}>
        <AnimatedRect
          animatedProps={lidProps}
          x={eye.cx - eye.r - 0.5}
          width={eye.r * 2 + 1}
          height={lidTravel}
          fill={lidFill}
        />
      </G>
    </>
  );
}

export function HomaCharacter({
  state,
  size,
}: {
  state: CharacterState;
  size: number;
}) {
  const reduced = useReducedMotion();
  /** One viewBox unit in on-screen px; every body distance scales by it. */
  const unit = size / 48;

  const bob = useSharedValue(0);
  const dip = useSharedValue(0);
  const pop = useSharedValue(1);
  const lean = useSharedValue(0);
  const squish = useSharedValue(0);
  const blink = useSharedValue(0);
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);
  const biasX = useSharedValue(0);
  const biasY = useSharedValue(0);
  const pupilScale = useSharedValue(1);

  const gazeX = useDerivedValue(() => driftX.value + biasX.value);
  const gazeY = useDerivedValue(() => driftY.value + biasY.value);

  // The ambient layer: lean, squish, blink, gaze. Starts once, runs at
  // unrelated periods (4700, 2120, ~6520, ~10470ms), never restarts on
  // a state change. Under reduced motion none of it ever starts.
  useEffect(() => {
    if (reduced) {
      lean.value = 0;
      squish.value = 0;
      blink.value = 0;
      driftX.value = 0;
      driftY.value = 0;
      return;
    }
    lean.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 2350, easing: BREATHE }),
        withTiming(-1.5, { duration: 2350, easing: BREATHE }),
      ),
      -1,
    );
    squish.value = withRepeat(
      withSequence(
        withTiming(0.024, { duration: 1060, easing: BREATHE }),
        withTiming(0, { duration: 1060, easing: BREATHE }),
      ),
      -1,
    );
    blink.value = blinkSequence();
    driftX.value = gazeSequence((waypoint) => waypoint.x);
    driftY.value = gazeSequence((waypoint) => waypoint.y);
    return () => {
      cancelAnimation(lean);
      cancelAnimation(squish);
      cancelAnimation(blink);
      cancelAnimation(driftX);
      cancelAnimation(driftY);
    };
  }, [reduced, lean, squish, blink, driftX, driftY]);

  // The stateful layer: the breath changes gear, the posture settles
  // over SETTLE_MS with the shared settle curve, and speaking adds the
  // gentle pop pulse (~720ms, in step with the aura's rhythm).
  useEffect(() => {
    if (reduced) {
      bob.value = 0;
      dip.value = 0;
      pop.value = 1;
      pupilScale.value = 1;
      biasX.value = 0;
      biasY.value = 0;
      return;
    }
    const breath = BOB[state];
    const posture = POSTURE[state];
    const amp = breath.amp * unit;
    bob.value = withSequence(
      withTiming(0, { duration: 260, easing: SETTLE }),
      withRepeat(
        withSequence(
          withTiming(-amp, { duration: breath.rise, easing: Easing.out(Easing.cubic) }),
          withTiming(-amp * 0.82, { duration: breath.hang, easing: BREATHE }),
          withTiming(0, { duration: breath.rest, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
    pop.value =
      state === "speaking"
        ? withSequence(
            withTiming(1, { duration: 240, easing: SETTLE }),
            withRepeat(
              withSequence(
                withTiming(1.03, { duration: 390, easing: BREATHE }),
                withTiming(1, { duration: 330, easing: BREATHE }),
              ),
              -1,
            ),
          )
        : withTiming(1, { duration: 260, easing: SETTLE });
    dip.value = withTiming(posture.dip * unit, { duration: SETTLE_MS, easing: SETTLE });
    pupilScale.value = withTiming(posture.pupilScale, { duration: SETTLE_MS, easing: SETTLE });
    biasX.value = withTiming(posture.gazeBiasX, { duration: SETTLE_MS, easing: SETTLE });
    biasY.value = withTiming(posture.gazeBiasY, { duration: SETTLE_MS, easing: SETTLE });
    return () => {
      cancelAnimation(bob);
      cancelAnimation(dip);
      cancelAnimation(pop);
      cancelAnimation(pupilScale);
      cancelAnimation(biasX);
      cancelAnimation(biasY);
    };
  }, [state, reduced, unit, bob, dip, pop, pupilScale, biasX, biasY]);

  const leanStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${lean.value}deg` }],
  }));
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value + dip.value }],
  }));
  const squishStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + squish.value }, { scaleY: 1 - squish.value }],
  }));
  // The warm ground shadow shrinks and fades as she rises, the one cue
  // that sells the float. Warm brown (the shadows token ink), never black.
  const shadowStyle = useAnimatedStyle(() => {
    const lift = unit > 0 ? Math.min(1, -bob.value / (unit * 2)) : 0;
    return {
      opacity: 0.14 - 0.05 * lift,
      transform: [{ scaleX: 1 - 0.08 * lift }],
    };
  });

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: -size / 2, top: -size / 2 }}
      >
        <Aura state={state} size={size} />
      </View>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: size * 0.27,
            top: size * 0.9,
            width: size * 0.46,
            height: size * 0.06,
            borderRadius: size * 0.03,
            backgroundColor: shadows.sm.shadowColor,
          },
          shadowStyle,
        ]}
      />
      <Animated.View
        style={[
          { width: size, height: size, transformOrigin: baseOrigin(size) },
          leanStyle,
        ]}
      >
        <Animated.View
          style={[{ flex: 1, transformOrigin: baseOrigin(size) }, popStyle]}
        >
          <Animated.View style={[{ flex: 1 }, bobStyle]}>
            <Animated.View
              style={[{ flex: 1, transformOrigin: baseOrigin(size) }, squishStyle]}
            >
              <Svg width={size} height={size} viewBox="0 0 48 48">
                <Path d={HOUSE_PATH} fill={colors.brand} />
                {EYES.map((eye) => (
                  <CharacterEye
                    key={eye.cx}
                    eye={eye}
                    blink={blink}
                    gazeX={gazeX}
                    gazeY={gazeY}
                    pupilScale={pupilScale}
                    lidFill={colors.brand}
                  />
                ))}
              </Svg>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
