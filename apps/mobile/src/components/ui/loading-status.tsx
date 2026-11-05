import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { fontFamilies , colors, fontSize, space } from "../../theme/app2";

/** A visible, named loading state with one explicit screen-reader announcement. */
export function LoadingStatus({
  label,
  showLabel = true,
  style,
}: {
  label: string;
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  useAccessibilityAnnouncement(label);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[
        {
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
        },
        style,
      ]}
    >
      <ActivityIndicator
        color={colors.brand}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {showLabel ? (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textMuted,
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
