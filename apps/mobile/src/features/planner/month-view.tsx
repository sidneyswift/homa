import { Pressable, Text, View } from "react-native";

import type { FamilyEventRecord } from "../../lib/family-events";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import {
  compareDateOnly,
  dayOfMonth,
  daysInRange,
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
  onSelectDate,
}: {
  anchorDate: DateOnly;
  events: FamilyEventRecord[];
  activities: ScheduledActivityView[];
  onSelectDate: (date: DateOnly) => void;
}) {
  const { start, end } = monthGridRange(anchorDate);
  const days = daysInRange(start, end);
  const today = todayDateOnly();

  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: "row" }}>
        {WEEKDAY_HEADERS.map((label, index) => (
          <View key={index} style={{ flex: 1, alignItems: "center", paddingVertical: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textSubtle }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, anchorDate);
          const isToday = day === today;
          const hasEvent = events.some(
            (event) => compareDateOnly(event.starts_on, day) <= 0 && compareDateOnly(event.ends_on, day) >= 0,
          );
          const hasActivity = activities.some((activity) => activity.scheduledDate === day);

          return (
            <Pressable
              key={day}
              onPress={() => onSelectDate(day)}
              style={{
                width: "14.2857%",
                aspectRatio: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isToday ? colors.brand : "transparent",
                }}
              >
                <Text
                  style={{
                    fontFamily: isToday ? fontFamilies.bodySemibold : fontFamilies.body,
                    fontSize: fontSize.sm,
                    color: isToday ? colors.onBrand : inMonth ? colors.textBody : colors.textSubtle,
                  }}
                >
                  {dayOfMonth(day)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 2, height: 4 }}>
                {hasEvent ? (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.sage }} />
                ) : null}
                {hasActivity ? (
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
