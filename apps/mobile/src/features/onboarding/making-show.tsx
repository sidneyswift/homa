import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Rect } from "react-native-svg";

import { NativeText } from "../../components/ui/semantic";
import { colors, palette, radius, space } from "../../theme/tokens";

/**
 * The making wait's show (gauntlet 2026-08-21, winner "Now drawing",
 * base concept 3 with the judge's steals and cuts). Homa works at the
 * crest above; down here on the sheet stands her easel, holding the
 * page with its BACK to the viewer, so real work is depicted and a
 * preview is structurally impossible (honest theater by construction).
 * The kid's own answers drift in as paper chips and land at the
 * easel's base; every visible string is either the parent's own answer
 * restated or the job's real note, nothing else (concept 1's copy
 * law). Tapping the stage pops a decorative gold spark that arcs to
 * the easel: the kid's toy, claiming nothing.
 */

const CHIP_INTERVAL_MS = 26_000;
const SPARK_POOL = 10;

/** One paper chip: the parent's verbatim answer on a tilted card. */
function FactChip({
  label,
  index,
  reduced,
}: {
  label: string;
  index: number;
  reduced: boolean;
}) {
  const drop = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    drop.value = withDelay(
      2_000 + index * CHIP_INTERVAL_MS,
      withSpring(1, { damping: 13, stiffness: 90 }),
    );
    return () => cancelAnimation(drop);
  }, [reduced, index, drop]);
  const tilt = index % 2 === 0 ? -4 : 5;
  const style = useAnimatedStyle(() => ({
    opacity: drop.value,
    transform: [
      { translateY: (1 - drop.value) * -140 },
      { rotate: `${tilt * drop.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.sm,
          paddingHorizontal: space.sm,
          paddingVertical: 6,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: palette.gold400,
        }}
      />
      <NativeText role="caption" tone="strong" style={{ color: palette.clay600 }}>
        {label}
      </NativeText>
    </Animated.View>
  );
}

/** A pooled decorative spark arcing from the tap point to the easel. */
function Spark({
  register,
}: {
  register: (fire: (x: number, y: number) => void) => void;
}) {
  const progress = useSharedValue(0);
  const start = useRef({ x: 0, y: 0 });
  const [, setNonce] = useState(0);
  useEffect(() => {
    register((x, y) => {
      start.current = { x, y };
      setNonce((n) => n + 1);
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: 900,
        easing: Easing.out(Easing.quad),
      });
    });
  }, [register, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value === 0 ? 0 : 1 - progress.value,
    transform: [
      { translateX: start.current.x + (60 - start.current.x) * progress.value },
      { translateY: start.current.y + (30 - start.current.y) * progress.value },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: palette.gold300,
        },
        style,
      ]}
    />
  );
}

export function MakingShow({
  chipLabels,
  completing,
  onExitDone,
}: {
  /** Verbatim parent answers, capped by the caller (copy law). */
  chipLabels: string[];
  /** True once the job reports completed: play the exit, then call back. */
  completing: boolean;
  onExitDone: () => void;
}) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const flutter = useSharedValue(0);
  const exit = useSharedValue(0);
  const exitFired = useRef(false);
  const sparkFires = useRef<((x: number, y: number) => void)[]>([]);
  const nextSpark = useRef(0);

  // The sheet breathes on the easel: alive, never progressing.
  useEffect(() => {
    if (reduced) return;
    flutter.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(flutter);
  }, [reduced, flutter]);

  // Completion: the drawing stops and the sheet leaves for the reveal.
  // Edge-on turn + fade (the judge cut the cross-route flip); capped so
  // the exit can never hold the navigation hostage.
  useEffect(() => {
    if (!completing || exitFired.current) return;
    exitFired.current = true;
    if (reduced) {
      onExitDone();
      return;
    }
    exit.value = withTiming(
      1,
      { duration: 450, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onExitDone)();
      },
    );
    const cap = setTimeout(onExitDone, 500);
    return () => clearTimeout(cap);
  }, [completing, reduced, exit, onExitDone]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [
      { perspective: 600 },
      { rotate: `${-2 + flutter.value * 1.2}deg` },
      { rotateY: `${exit.value * 88}deg` },
      { scale: 1 + exit.value * 0.12 },
      { translateY: exit.value * -24 },
    ],
  }));

  function fireSpark(x: number, y: number) {
    if (reduced) return;
    const fire = sparkFires.current[nextSpark.current % sparkFires.current.length];
    nextSpark.current += 1;
    if (fire) fire(x, y);
  }

  const easelWidth = Math.min(width * 0.42, 170);
  const easelHeight = easelWidth * 1.25;

  const registerSpark = useMemo(
    () =>
      Array.from({ length: SPARK_POOL }, (_, i) => (fire: (x: number, y: number) => void) => {
        sparkFires.current[i] = fire;
      }),
    [],
  );

  return (
    <Pressable
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onPress={(event) =>
        fireSpark(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      style={{ alignItems: "center", gap: space.sm }}
    >
      {/* The easel, sheet facing away: her work, our wait. */}
      <Animated.View style={sheetStyle}>
        <Svg width={easelWidth} height={easelHeight} viewBox="0 0 100 125">
          {/* board legs */}
          <Rect x={14} y={70} width={5} height={52} rx={2.5} fill={palette.clay600} transform="rotate(8 16 70)" />
          <Rect x={81} y={70} width={5} height={52} rx={2.5} fill={palette.clay600} transform="rotate(-8 84 70)" />
          {/* drawing board */}
          <Rect x={8} y={6} width={84} height={100} rx={6} fill={palette.clay300} />
          {/* the sheet's BACK: plain cream, nothing to preview */}
          <Rect x={14} y={12} width={72} height={88} rx={3} fill={colors.card} />
          <Rect x={14} y={12} width={72} height={88} rx={3} fill="none" stroke={colors.borderSubtle} strokeWidth={1} />
          {/* board clip */}
          <Circle cx={50} cy={10} r={4.5} fill={palette.clay600} />
        </Svg>
      </Animated.View>

      {/* Her references: the parent's own words, landed at the base. */}
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: space.xs,
          paddingHorizontal: space.md,
        }}
      >
        {chipLabels.map((label, index) => (
          <FactChip key={label} label={label} index={index} reduced={reduced} />
        ))}
      </View>

      {Array.from({ length: SPARK_POOL }, (_, i) => (
        <Spark key={i} register={registerSpark[i]} />
      ))}
    </Pressable>
  );
}
