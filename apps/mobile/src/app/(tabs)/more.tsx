import { router, type Href } from "expo-router";
import { Pressable, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, pressScale, radius, space } from "../../theme/tokens";

/**
 * More: everything that earns a screen but not a tab slot (iOS tab
 * bars hold five comfortably; Today, Chat, Planner, and Progress won
 * the other four). Lessons open from Planner and Progress, not here.
 */

const ROWS: { label: string; hint: string; href: Href }[] = [
  { label: "Tasks", hint: "Your to-dos, big and small", href: "/tasks" },
  { label: "Binder", hint: "Everything Homa has made for you", href: "/binder" },
  { label: "Family", hint: "Who Homa knows", href: "/family" },
  { label: "Settings", hint: "Account and plan", href: "/settings" },
];

function Chevron() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M9 5 L16 12 L9 19"
        fill="none"
        stroke={colors.textMuted}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function MoreScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <Text
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSize.xxl,
            color: colors.textStrong,
          }}
        >
          More
        </Text>
        {ROWS.map((row) => (
          <Pressable
            key={row.label}
            accessibilityRole="button"
            onPress={() => router.push(row.href)}
            style={({ pressed }) => ({
              backgroundColor: colors.card,
              borderColor: colors.borderSubtle,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingVertical: space.md,
              paddingHorizontal: space.md,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              transform: [{ scale: pressed ? pressScale : 1 }],
            })}
          >
            <Text style={{ gap: 2 }}>
              <Text
                style={{
                  fontFamily: fontFamilies.displaySemibold,
                  fontSize: fontSize.lg,
                  color: colors.textStrong,
                }}
              >
                {row.label}
                {"\n"}
              </Text>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  color: colors.textMuted,
                }}
              >
                {row.hint}
              </Text>
            </Text>
            <Chevron />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
