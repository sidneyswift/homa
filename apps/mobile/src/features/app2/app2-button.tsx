import type { ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { colors, fontFamilies, fontSize, pressScale, radius, space } from "../../theme/app2";

type Variant = "primary" | "secondary" | "quiet";
type Size = "sm" | "lg";

const SIZES: Record<Size, { minHeight: number; paddingHorizontal: number; paddingVertical: number }> = {
  sm: { minHeight: 44, paddingHorizontal: space.md, paddingVertical: space.sm },
  lg: { minHeight: 52, paddingHorizontal: space.lg, paddingVertical: 14 },
};

/**
 * The App 2 control: ink on white, matching web App 2's controls (control
 * radius, #f5f5f5 press fill, ink text). Accessibility mirrors the shared
 * NativeAction: a disabled control keeps a page fill and muted label, and a
 * busy one keeps its live look while work happens.
 */
export function App2Button({
  label,
  onPress,
  accessibilityHint,
  variant = "primary",
  size = "lg",
  disabled = false,
  busy = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  busy?: boolean;
  /** Optional mark before the label, e.g. the Google glyph. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const look = variant === "primary"
    ? { backgroundColor: colors.action, borderColor: colors.action, text: colors.onBrand }
    : variant === "secondary"
      ? { backgroundColor: colors.card, borderColor: colors.border, text: colors.textStrong }
      : { backgroundColor: "transparent", borderColor: "transparent", text: colors.textStrong };
  const resting = disabled && !busy && variant !== "quiet"
    ? { backgroundColor: colors.page, borderColor: colors.textMuted, text: colors.textMuted }
    : disabled && !busy
      ? { ...look, text: colors.textMuted }
      : look;
  const unavailable = disabled || busy;
  const stacked = Boolean(icon) && fontScale >= 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: unavailable, busy }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        {
          ...SIZES[size],
          borderRadius: radius.md,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: resting.borderColor,
          backgroundColor: pressed && variant !== "primary" ? colors.surfaceSunken : resting.backgroundColor,
          alignItems: "center",
          justifyContent: "center",
          opacity: busy ? 0.55 : 1,
          transform: reducedMotion ? undefined : [{ scale: pressed ? pressScale : 1 }],
        },
        style,
      ]}
    >
      <View style={{ flexDirection: stacked ? "column" : "row", alignItems: "center", justifyContent: "center", gap: stacked ? space.xs : space.sm, flexShrink: 1, maxWidth: "100%" }}>
        {icon}
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.base, color: resting.text, textAlign: "center", flexShrink: 1 }}>{label}</Text>
      </View>
    </Pressable>
  );
}
