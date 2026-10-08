import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import type { FamilyEventRecord } from "../../lib/family-events";
import type { PlannerLearningActivityRecord } from "../../lib/planner-learning-activities";
import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";
import {
  compareDateOnly,
  dayOfMonth,
  daysInRange,
  formatFullDate,
  isSameMonth,
  monthGridRange,
  todayDateOnly,
  type DateOnly,
} from "./date-utils";
import type { ScheduledActivityView } from "./planner-model";

const WEEKDAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

export function MonthView({
  anchorDate,
  events,
  activities,
  learningActivities,
  onSelectDate,
}: {
  anchorDate: DateOnly;
  events: FamilyEventRecord[];
  activities: ScheduledActivityView[];
  learningActivities: PlannerLearningActivityRecord[];
  onSelectDate: (date: DateOnly) => void;
}) {
  const { fontScale, width } = useWindowDimensions();
  const { start, end } = monthGridRange(anchorDate);
  const days = daysInRange(start, end);
  const today = todayDateOnly();
  const largeText = fontScale >= 1.8;
  const gridWidth = Math.max(width - (space.md * 2), 7 * 48);
  const dayEntries = days.map((day) => {
    const inMonth = isSameMonth(day, anchorDate);
    const isToday = day === today;
    const eventCount = events.filter(
      (event) => compareDateOnly(event.starts_on, day) <= 0 && compareDateOnly(event.ends_on, day) >= 0,
    ).length;
    const activityCount = activities.filter((activity) => activity.scheduledDate === day).length
      + learningActivities.filter((activity) => activity.activityDate === day).length;
    const countSummary = [
      eventCount > 0 ? `${eventCount} ${eventCount === 1 ? "event" : "events"}` : "No events",
      activityCount > 0 ? `${activityCount} ${activityCount === 1 ? "activity" : "activities"}` : "No activities",
    ].join(" · ");
    const accessibilitySummary = [
      formatFullDate(day),
      isToday ? "Today" : null,
      countSummary,
    ].filter(Boolean).join(". ");
    return { day, inMonth, isToday, eventCount, activityCount, countSummary, accessibilitySummary };
  });

  if (largeText) {
    return (
      <View style={{ gap: space.xs }}>
        {dayEntries.filter((entry) => entry.inMonth).map((entry) => (
          <Pressable
            key={entry.day}
            accessible
            accessibilityRole="button"
            accessibilityLabel={entry.accessibilitySummary}
            accessibilityHint="Shows this day in Planner"
            onPress={() => onSelectDate(entry.day)}
            style={({ pressed }) => ({
              minHeight: 56,
              borderRadius: radius.sm,
              borderWidth: entry.isToday ? 2 : 1,
              borderColor: entry.isToday ? colors.action : colors.borderSubtle,
              backgroundColor: pressed ? colors.surfaceSunken : colors.card,
              padding: space.sm,
              gap: space.xs,
            })}
          >
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.base, color: colors.textStrong }}>
              {formatFullDate(entry.day)}{entry.isToday ? " · Today" : ""}
            </Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
              {entry.countSummary}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      accessibilityLabel="Month calendar"
      showsHorizontalScrollIndicator={false}
    >
      <View style={{ width: gridWidth, gap: space.xs }}>
        <View style={{ flexDirection: "row" }}>
          {WEEKDAY_HEADERS.map((label, index) => (
            <View key={index} style={{ flex: 1, alignItems: "center", paddingVertical: space.xs }}>
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {dayEntries.map((entry) => (
            <Pressable
              key={entry.day}
              accessible
              accessibilityRole="button"
              accessibilityLabel={entry.accessibilitySummary}
              accessibilityHint="Shows this day in Planner"
              onPress={() => onSelectDate(entry.day)}
              style={{
                width: "14.2857%",
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <View
                style={{
                  minWidth: 32,
                  height: 32,
                  paddingHorizontal: space.xs,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: entry.isToday ? colors.action : "transparent",
                }}
              >
                <Text
                  style={{
                    fontFamily: entry.isToday ? fontFamilies.bodySemibold : fontFamilies.body,
                    fontSize: fontSize.sm,
                    color: entry.isToday ? colors.onBrand : entry.inMonth ? colors.textBody : colors.textMuted,
                  }}
                >
                  {dayOfMonth(entry.day)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 2, height: 4 }}>
                {entry.eventCount > 0 ? (
                  <View style={{ width: 6, height: 3, borderRadius: 1, backgroundColor: colors.success }} />
                ) : null}
                {entry.activityCount > 0 ? (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
