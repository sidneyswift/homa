import { View } from "react-native";

import type { ChildRecord } from "../../lib/family";
import type { FamilyEventRecord } from "../../lib/family-events";
import { space } from "../../theme/tokens";
import { DayAgenda } from "./day-agenda";
import { daysInRange, addDays, compareDateOnly, type DateOnly } from "./date-utils";
import type { PlanActivityView, ScheduledActivityView } from "./planner-model";
import { UnscheduledTray } from "./unscheduled-tray";

/** A vertical 7-day agenda (Mon–Sun), the mobile-native shape of web's
 * pixel-positioned hour grid — a real time grid doesn't fit a phone's
 * width, and a scrolling day-by-day list is the pattern every mobile
 * calendar app already uses. */
export function WeekView({
  weekStart,
  events,
  activities,
  unscheduled,
  kids,
  onPressEvent,
  onToggleActivity,
  onScheduleActivity,
}: {
  weekStart: DateOnly;
  events: FamilyEventRecord[];
  activities: ScheduledActivityView[];
  unscheduled: PlanActivityView[];
  kids: ChildRecord[];
  onPressEvent: (event: FamilyEventRecord) => void;
  onToggleActivity: (activity: ScheduledActivityView) => void;
  onScheduleActivity: (activity: PlanActivityView) => void;
}) {
  const days = daysInRange(weekStart, addDays(weekStart, 6));

  return (
    <View style={{ gap: space.md }}>
      <UnscheduledTray activities={unscheduled} onSchedule={onScheduleActivity} />
      {days.map((day) => (
        <DayAgenda
          key={day}
          date={day}
          events={events.filter((event) => compareDateOnly(event.starts_on, day) <= 0 && compareDateOnly(event.ends_on, day) >= 0)}
          activities={activities.filter((activity) => activity.scheduledDate === day)}
          kids={kids}
          onPressEvent={onPressEvent}
          onToggleActivity={onToggleActivity}
        />
      ))}
    </View>
  );
}
