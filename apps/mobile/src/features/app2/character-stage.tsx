import { motion } from "@homa/design/motion";
import { useEffect } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { colors, fontFamilies, fontSize, radius, shadows, space } from "../../theme/app2";
import { HomaCharacter3D } from "./homa-character-3d";

const [x1, y1, x2, y2] = motion.easeOut.match(/[\d.]+/g)!.map(Number);
const ease = Easing.bezier(x1, y1, x2, y2);

/** Mirrors web App 2's stage: large and high while idle, a small mark above the transcript once she is talking. */
export function CharacterStage({ engaged, activity }: { engaged: boolean; activity: string | null }) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const idleSize = Math.min(208, width * 0.49);
  const engagedSize = Math.min(80, height * 0.1);
  const duration = reducedMotion ? 0 : motion.durations.slow;
  const current = useSharedValue(engaged ? engagedSize : idleSize);

  useEffect(() => {
    current.value = withTiming(engaged ? engagedSize : idleSize, { duration, easing: ease });
  }, [current, duration, engaged, engagedSize, idleSize]);

  const frame = useAnimatedStyle(() => ({ width: current.value, height: current.value }));
  // The canvas keeps one size and scales, so the GL surface never resizes mid-transition.
  const scaled = useAnimatedStyle(() => ({
    left: (current.value - idleSize) / 2,
    top: (current.value - idleSize) / 2,
    transform: [{ scale: current.value / idleSize }],
  }));

  return (
    <Animated.View
      layout={LinearTransition.duration(duration).easing(ease)}
      style={engaged ? { alignItems: "center", paddingTop: space.sm } : { flex: 1, alignItems: "center", paddingTop: space.md }}
    >
      <Animated.View style={frame}>
        <Animated.View style={[{ position: "absolute", width: idleSize, height: idleSize }, scaled]}>
          <HomaCharacter3D size={idleSize} />
        </Animated.View>
      </Animated.View>
      {activity ? <ActivityPill label={activity} /> : null}
    </Animated.View>
  );
}

/** Web's activity bubble: progress stays attached to Homa instead of entering the transcript. */
function ActivityPill({ label }: { label: string }) {
  useAccessibilityAnnouncement(label);
  return (
    <View style={{ marginTop: -space.sm, maxWidth: 320, paddingHorizontal: 12, paddingVertical: space.xs, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.lg, backgroundColor: colors.card, ...shadows.sm }}>
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, lineHeight: 16, color: colors.textMuted, textAlign: "center" }}>{label}</Text>
    </View>
  );
}
