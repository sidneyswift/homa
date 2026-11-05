import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Icon } from "../design/icon";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { fontFamilies , colors, darkColors, fontSize, radius, space } from "../../theme/app2";

/** A visible and screen-reader-live recovery message, never color alone. */
export function InlineError({
  message,
  style,
  tone = "light",
}: {
  message: string;
  style?: StyleProp<ViewStyle>;
  tone?: "light" | "dark";
}) {
  const look = tone === "dark"
    ? {
        border: darkColors.danger,
        background: darkColors.dangerSoft,
        icon: darkColors.danger,
        text: darkColors.textBody,
      }
    : {
        border: colors.danger,
        background: colors.dangerSoft,
        icon: colors.danger,
        text: colors.textBody,
      };
  const accessibilityMessage = `Error. ${message}`;
  useAccessibilityAnnouncement(accessibilityMessage);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityMessage}
      style={[
        {
          minHeight: 44,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: look.border,
          backgroundColor: look.background,
        },
        style,
      ]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name="error" size={20} color={look.icon} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: fontFamilies.bodyMedium,
          fontSize: fontSize.sm,
          lineHeight: 20,
          color: look.text,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
