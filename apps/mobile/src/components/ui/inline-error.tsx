import { CircleAlert } from "lucide-react-native";
import { useEffect } from "react";
import {
  AccessibilityInfo,
  Platform,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

/** A visible and screen-reader-live recovery message, never color alone. */
export function InlineError({
  message,
  style,
}: {
  message: string;
  style?: StyleProp<ViewStyle>;
}) {
  useEffect(() => {
    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={[
        {
          minHeight: 44,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.danger,
          backgroundColor: colors.dangerSoft,
        },
        style,
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <CircleAlert size={19} color={colors.danger} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: fontFamilies.bodyMedium,
          fontSize: fontSize.sm,
          lineHeight: 20,
          color: colors.textBody,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
