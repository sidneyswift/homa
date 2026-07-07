import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";

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
  variant = "primary",
  size = "md",
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const look = VARIANT_STYLES[variant];
  const vertical = size === "lg" ? 14 : size === "md" ? 12 : 8;
  const horizontal = size === "lg" ? space.lg : size === "md" ? 20 : space.md;
  const textSize = size === "sm" ? fontSize.sm : fontSize.base;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: look.backgroundColor,
          borderColor: look.borderColor,
          borderWidth: 1,
          borderRadius: radius.pill,
          paddingVertical: vertical,
          paddingHorizontal: horizontal,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.6 : 1,
          transform: [{ scale: pressed ? pressScale : 1 }],
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: textSize,
          color: look.textColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
