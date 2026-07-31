import { useEffect } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import { SUGGESTIONS } from "../chat/chat-session";
import { idleSuggestions } from "./suggestion-chips-model";

/**
 * The idle whisper: chat's exact opening prompts (chat-session.tsx owns
 * the list) floating as at most three soft pills above the ribbon while
 * the surface is quiet. An inviting whisper, not a menu: translucent
 * warm fills, hairline borders, muted text, nothing that competes with
 * the character. The parent decides visibility (suggestion-chips-model
 * .ts); this view only fades, staying mounted so the fade-out can play,
 * and once a turn starts the parent's retire latch keeps it gone until
 * the screen remounts.
 */

/** Translucent chip fills over the live gradient field: warm white over
 *  cream, warm stone over night navy, both letting the field breathe
 *  through (the tokens are opaque hex, so the alpha lives here, the
 *  NIGHT_NAVY and scrim idiom). */
const CHIP_FILL_LIGHT = "rgba(255,255,255,0.55)";
const CHIP_FILL_DARK = "rgba(78,70,62,0.45)";
const CHIP_BORDER_LIGHT = "rgba(214,200,180,0.7)";
const CHIP_BORDER_DARK = "rgba(214,200,180,0.28)";

export function SuggestionChips({
  visible,
  tone,
  onPick,
}: {
  visible: boolean;
  tone: "light" | "dark";
  onPick: (text: string) => void;
}) {
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  }, [opacity, visible]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        {
          alignItems: "center",
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: space.md,
        },
        fadeStyle,
      ]}
    >
      {idleSuggestions(SUGGESTIONS).map((suggestion) => (
        <Pressable
          key={suggestion}
          accessibilityRole="button"
          onPress={() => onPick(suggestion)}
          style={({ pressed }) => ({
            borderRadius: radius.pill,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: tone === "dark" ? CHIP_BORDER_DARK : CHIP_BORDER_LIGHT,
            backgroundColor: tone === "dark" ? CHIP_FILL_DARK : CHIP_FILL_LIGHT,
            paddingHorizontal: space.md,
            paddingVertical: 10,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: tone === "dark" ? palette.stone300 : colors.textMuted,
            }}
          >
            {suggestion}
          </Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}
