import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import {
  NativeAction,
  type NativeActionSize,
  type NativeActionVariant,
} from "./semantic";

/**
 * The Homa button: functional controls use the contract's 12px control
 * radius, midnight action ink, and a quiet secondary boundary. Press
 * feedback is a small scale only when motion is allowed.
 */

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonTone = "light" | "dark";

const BUTTON_VARIANT_TO_NATIVE_ACTION: Record<ButtonVariant, NativeActionVariant> = {
  primary: "primary",
  secondary: "secondary",
  ghost: "quiet",
};

export function Button({
  label,
  onPress,
  accessibilityHint,
  variant = "primary",
  tone = "light",
  size = "md",
  disabled = false,
  busy = false,
  icon,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: NativeActionSize;
  disabled?: boolean;
  busy?: boolean;
  /** Optional mark shown before the label, e.g. the Google glyph. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Stable, screen-scoped driver name, e.g. "paywall.subscribe"
   *  (spec Outcome 7). Additive to accessibility, never a replacement. */
  testID?: string;
}) {
  return (
    <NativeAction
      appearance={tone}
      accessibilityHint={accessibilityHint}
      busy={busy}
      disabled={disabled}
      icon={icon}
      label={label}
      onPress={onPress}
      size={size}
      style={style}
      testID={testID}
      variant={BUTTON_VARIANT_TO_NATIVE_ACTION[variant]}
    />
  );
}
