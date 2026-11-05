import { forwardRef, type ReactNode } from "react";
import {
  Pressable,
  View,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { radius } from "../../theme/app2";

/** A named icon action with a guaranteed 44-point target. */
interface IconButtonProps {
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Stable, screen-scoped driver name (spec Outcome 7). Additive to
   *  the accessibility label, never a replacement. */
  testID?: string;
}

export const IconButton = forwardRef<View, IconButtonProps>(function IconButton({
  accessibilityHint,
  accessibilityState,
  children,
  disabled = false,
  label,
  onPress,
  style,
  testID,
}, ref) {
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.pill,
          opacity: disabled ? 0.5 : pressed ? 0.65 : 1,
        },
        style,
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </View>
    </Pressable>
  );
});
