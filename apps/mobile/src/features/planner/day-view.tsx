import { View } from "react-native";

import type { ChildRecord } from "../../lib/family";
import type { FamilyEventRecord } from "../../lib/family-events";
import { space } from "../../theme/tokens";
import { DayAgenda } from "./day-agenda";
import { compareDateOnly, type DateOnly } from "./date-utils";
import type { PlanActivityView, ScheduledActivityView } from "./planner-model";
import { UnscheduledTray } from "./unscheduled-tray";

export function DayView({
  date,
  events,
  activities,
  unscheduled,
  kids,
  onPressEvent,
  onToggleActivity,
  onScheduleActivity,
}: {
  date: DateOnly;
  events: FamilyEventRecord[];
  activities: ScheduledActivityView[];
  unscheduled: PlanActivityView[];
  kids: ChildRecord[];
  onPressEvent: (event: FamilyEventRecord) => void;
  onToggleActivity: (activity: ScheduledActivityView) => void;
  onScheduleActivity: (activity: PlanActivityView) => void;
}) {
  return (
    <View style={{ gap: space.md }}>
      <DayAgenda
        date={date}
        events={events.filter(
          (event) => compareDateOnly(event.starts_on, date) <= 0 && compareDateOnly(event.ends_on, date) >= 0,
        )}
        activities={activities.filter((activity) => activity.scheduledDate === date)}
        kids={kids}
        onPressEvent={onPressEvent}
        onToggleActivity={onToggleActivity}
        showWeekday={false}
      />
      <UnscheduledTray activities={unscheduled} onSchedule={onScheduleActivity} />
    </View>
  );
}
