import type { ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, pressScale, radius, space } from "../../theme/tokens";

/**
 * The Homa button: always pill-shaped (never square, per the component
 * catalog), warm clay primary, quiet secondary. Press feedback is the
 * design system's gentle scale, no bounce.
 */

type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_STYLES: Record<
  ButtonVariant,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  primary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    textColor: colors.onBrand,
  },
  secondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    textColor: colors.textStrong,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    textColor: colors.brand,
  },
};

export function Button({
  label,
  onPress,
  accessibilityHint,
  variant = "primary",
  size = "md",
  disabled = false,
  busy = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  busy?: boolean;
  /** Optional mark shown before the label, e.g. the Google glyph. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const look = VARIANT_STYLES[variant];
  const vertical = size === "lg" ? 14 : size === "md" ? 12 : 8;
  const horizontal = size === "lg" ? space.lg : size === "md" ? 20 : space.md;
  const textSize = size === "sm" ? fontSize.sm : fontSize.base;
  const minimumHeight = size === "lg" ? 52 : size === "md" ? 48 : 44;
  const unavailable = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: unavailable, busy }}
      onPress={onPress}
      disabled={unavailable}
      style={({ pressed }) => [
        {
          backgroundColor: look.backgroundColor,
          borderColor: look.borderColor,
          borderWidth: 1,
          borderRadius: radius.pill,
          minHeight: minimumHeight,
          paddingVertical: vertical,
          paddingHorizontal: horizontal,
          alignItems: "center",
          justifyContent: "center",
          opacity: unavailable ? 0.6 : 1,
          transform: [{ scale: pressed ? pressScale : 1 }],
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: icon ? space.sm : 0,
        }}
      >
        {icon}
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: textSize,
            color: look.textColor,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
