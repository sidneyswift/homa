import { Pressable, Text, View, useWindowDimensions } from "react-native";

import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";
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
  const { fontScale } = useWindowDimensions();
  if (activities.length === 0) return null;

  const largeText = fontScale >= 1.4;

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
          accessibilityRole="button"
          accessibilityLabel={`Put ${activity.text} on a day for ${activity.childName}, ${activity.subjectName}`}
          accessibilityHint="Opens the date picker"
          onPress={() => onSchedule(activity)}
          style={{
            minHeight: 48,
            flexDirection: largeText ? "column" : "row",
            justifyContent: "space-between",
            alignItems: largeText ? "stretch" : "center",
            gap: space.sm,
            paddingVertical: space.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
              {activity.text}
            </Text>
            <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textMuted }}>
              {activity.childName} · {activity.subjectName}
            </Text>
            {activity.sources.length > 0 ? (
              <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textMuted }}>
                From {activity.sources
                  .map((source) =>
                    `${source.title}${source.sourceLocator ? ` · ${source.sourceLocator}` : ""}`,
                  )
                  .join(", ")}
              </Text>
            ) : null}
          </View>
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textStrong }}>
            Put on a day
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
