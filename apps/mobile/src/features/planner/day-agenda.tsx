import { Text, View } from "react-native";

import type { ChildRecord } from "../../lib/family";
import { familyEventChildIds, type FamilyEventRecord } from "../../lib/family-events";
import type { PlannerLearningActivityRecord } from "../../lib/planner-learning-activities";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";
import { ActivityRow } from "./activity-row";
import type { DateOnly } from "./date-utils";
import { formatWeekdayLong, formatMonthDay, todayDateOnly } from "./date-utils";
import { EventCard } from "./event-card";
import { LearningActivityRow } from "./learning-activity-row";
import type { ScheduledActivityView } from "./planner-model";

/** One day's worth of family events + scheduled activities, the shared
 * agenda unit both the week and day views render (a mobile-native
 * "schedule" layout rather than web's pixel-positioned hour grid, which
 * doesn't fit a phone's width). */
export function DayAgenda({
  date,
  events,
  activities,
  learningActivities,
  kids,
  onPressEvent,
  onToggleActivity,
  onToggleLearningActivity,
  showWeekday = true,
}: {
  date: DateOnly;
  events: FamilyEventRecord[];
  activities: ScheduledActivityView[];
  learningActivities: PlannerLearningActivityRecord[];
  kids: ChildRecord[];
  onPressEvent?: (event: FamilyEventRecord) => void;
  onToggleActivity: (activity: ScheduledActivityView) => Promise<void>;
  onToggleLearningActivity: (activity: PlannerLearningActivityRecord) => Promise<void>;
  showWeekday?: boolean;
}) {
  const isToday = date === todayDateOnly();
  const hasContent = events.length > 0 || activities.length > 0 || learningActivities.length > 0;

  return (
    <View style={{ gap: space.xs }}>
      {showWeekday ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.xs }}>
          <Text
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.sm,
              color: colors.textStrong,
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
          {events.map((event) => {
            const childIds = familyEventChildIds(event);
            const names = childIds
              .map((childId) => kids.find((kid) => kid.id === childId)?.name)
              .filter((name): name is string => Boolean(name));
            const childIndex = childIds.length === 1
              ? kids.findIndex((kid) => kid.id === childIds[0])
              : null;
            return (
              <EventCard
                key={event.occurrence_key ?? `${event.id}:${event.starts_on}`}
                event={event}
                childIndex={childIndex === -1 ? null : childIndex}
                audienceLabel={names.length > 0 ? names.join(" + ") : "Whole family"}
                onPress={onPressEvent ? () => onPressEvent(event) : undefined}
              />
            );
          })}
          {activities.map((activity) => (
            <ActivityRow
              key={activity.scheduleId}
              activity={activity}
              onToggle={() => onToggleActivity(activity)}
            />
          ))}
          {learningActivities.map((activity) => (
            <LearningActivityRow
              key={activity.id}
              activity={activity}
              kids={kids}
              onToggle={() => onToggleLearningActivity(activity)}
            />
          ))}
        </View>
      ) : (
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
          Nothing planned. Tap + to add an event.
        </Text>
      )}
    </View>
  );
}
