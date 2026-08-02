import { Check } from "lucide-react-native";
import { Linking, Pressable, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import type { PlanActivityView } from "./planner-model";

/**
 * One plan activity: a checkbox plus its text, ported from web's
 * ActivityCard/usePlanChecks (apps/web/app/app/planner/day-grid.tsx).
 * Checking here calls toggle_plan_activity_check (an atomic single-key
 * write), not web's whole-map-replace POST.
 */
export function ActivityRow({
  activity,
  onToggle,
}: {
  activity: PlanActivityView;
  onToggle: () => void;
}) {
  return (
    <View style={{ paddingVertical: space.xs }}>
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.xs,
            borderWidth: 1.5,
            borderColor: activity.done ? colors.brand : colors.border,
            backgroundColor: activity.done ? colors.brand : "transparent",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          {activity.done ? <Check size={13} color={colors.onBrand} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: activity.done ? colors.textMuted : colors.textBody,
              textDecorationLine: activity.done ? "line-through" : "none",
            }}
          >
            {activity.text}
          </Text>
          <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textSubtle }}>
            {activity.childName} · {activity.subjectName}
          </Text>
        </View>
      </Pressable>
      {activity.sources.length > 0 ? (
        <View style={{ marginLeft: 28, marginTop: 3, flexDirection: "row", flexWrap: "wrap" }}>
          <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textSubtle }}>
            From{" "}
          </Text>
          {activity.sources.map((source, index) => (
            <Pressable
              key={source.id}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(source.libraryUrl)}
            >
              <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.brand, textDecorationLine: "underline" }}>
                {index > 0 ? `, ${source.title}` : source.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
