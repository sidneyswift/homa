import { Text, View } from "react-native";

import type { ChildRecord } from "../../lib/family";
import type { FamilyEventRecord } from "../../lib/family-events";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";
import { ActivityRow } from "./activity-row";
import type { DateOnly } from "./date-utils";
import { formatWeekdayLong, formatMonthDay, todayDateOnly } from "./date-utils";
import { EventCard } from "./event-card";
import type { ScheduledActivityView } from "./planner-model";

/** One day's worth of family events + scheduled activities, the shared
 * agenda unit both the week and day views render (a mobile-native
 * "schedule" layout rather than web's pixel-positioned hour grid, which
 * doesn't fit a phone's width). */
export function DayAgenda({
  date,
  events,
  activities,
  kids,
  onPressEvent,
  onToggleActivity,
  showWeekday = true,
}: {
  date: DateOnly;
  events: FamilyEventRecord[];
  activities: ScheduledActivityView[];
  kids: ChildRecord[];
  onPressEvent: (event: FamilyEventRecord) => void;
  onToggleActivity: (activity: ScheduledActivityView) => Promise<void>;
  showWeekday?: boolean;
}) {
  const isToday = date === todayDateOnly();
  const hasContent = events.length > 0 || activities.length > 0;

  return (
    <View style={{ gap: space.xs }}>
      {showWeekday ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.xs }}>
          <Text
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.sm,
              color: isToday ? colors.brand : colors.textStrong,
            }}
          >
            {formatWeekdayLong(date)}
          </Text>
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
            {formatMonthDay(date)}
            {isToday ? " · Today" : ""}
          </Text>
        </View>
      ) : null}

      {hasContent ? (
        <View style={{ gap: 6 }}>
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              childIndex={event.child_id ? kids.findIndex((c) => c.id === event.child_id) : null}
              onPress={() => onPressEvent(event)}
            />
          ))}
          {activities.map((activity) => (
            <ActivityRow
              key={activity.scheduleId}
              activity={activity}
              onToggle={() => onToggleActivity(activity)}
            />
          ))}
        </View>
      ) : (
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textSubtle }}>
          Nothing planned.
        </Text>
      )}
    </View>
  );
}
