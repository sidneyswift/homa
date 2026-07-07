import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, shadows, space } from "../../theme/tokens";

/** White surface, 22px corners, soft warm shadow (the design system card). */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          padding: space.lg,
          ...shadows.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
