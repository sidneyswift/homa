import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { CalendarDays } from "lucide-react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";

/**
 * The chat transcript's planner pointer: when Homa opens the planner
 * (open_planner), chat shows this card instead of silence, and the
 * parent taps through to the real Planner tab. The web twin is the
 * PlannerCard chip in planner-canvas.tsx; the voice surface renders the
 * week as a live sheet instead (features/voice/overlay-host.tsx).
 * Closing the issue #256 posture: open_planner's honesty note now says
 * a planner view opens on this client, so something real must render.
 */
export function PlannerCard({ childName }: { childName: string | null }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open the planner"
      onPress={() => router.push("/(tabs)/planner")}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        opacity: pressed ? 0.8 : 1,
        ...shadows.sm,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.brandSoft,
        }}
      >
        <CalendarDays size={18} color={colors.brand} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.base,
            color: colors.textStrong,
          }}
        >
          {childName ? `${childName}'s week is on the planner` : "The week is on the planner"}
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textMuted,
          }}
        >
          Tap to open it
        </Text>
      </View>
    </Pressable>
  );
}
