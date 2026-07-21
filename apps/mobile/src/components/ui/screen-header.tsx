import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Header for stack screens pushed over the tabs (Tasks, Binder,
 * Settings, Family and friends): back chevron plus a display title,
 * keeping every pushed screen's top edge consistent.
 */
export function ScreenHeader({ title }: { title: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/");
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M15 5 L8 12 L15 19"
            fill="none"
            stroke={colors.textStrong}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
      <Text
        style={{
          fontFamily: fontFamilies.display,
          fontSize: fontSize.xl,
          color: colors.textStrong,
        }}
      >
        {title}
      </Text>
    </View>
  );
}
