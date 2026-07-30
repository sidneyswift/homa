import { Pressable, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import type { PlanActivityView } from "./planner-model";

/**
 * This week's plan activities with no day assigned yet. Mobile's own
 * addition: web has no direct scheduling UI at all today (only the
 * schedule_plan_activity chat tool can put an activity on a real date;
 * apps/web/app/app/calendar/calendar-view.tsx's own header comment calls
 * itself "an optimizer... this page only displays"). Tapping one here
 * opens a date picker and upserts plan_activity_schedule directly.
 */
export function UnscheduledTray({
  activities,
  onSchedule,
}: {
  activities: PlanActivityView[];
  onSchedule: (activity: PlanActivityView) => void;
}) {
  if (activities.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: colors.surfaceSunken,
        borderRadius: radius.md,
        padding: space.md,
        gap: space.xs,
      }}
    >
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
        Not yet on a day
      </Text>
      {activities.map((activity) => (
        <Pressable
          key={`${activity.childId}.${activity.subjectId}.${activity.week}.${activity.activityIndex}`}
          onPress={() => onSchedule(activity)}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingVertical: space.xs,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
              {activity.text}
            </Text>
            <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textSubtle }}>
              {activity.childName} · {activity.subjectName}
            </Text>
          </View>
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.brand }}>
            Put on a day
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
