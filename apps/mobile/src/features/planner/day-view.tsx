import { View } from "react-native";

import type { ChildRecord } from "../../lib/family";
import type { FamilyEventRecord } from "../../lib/family-events";
import type { HoursLogRow } from "../../lib/hours";
import type { PlannerLearningActivityRecord } from "../../lib/planner-learning-activities";
import { space } from "../../theme/tokens";
import { DayAgenda } from "./day-agenda";
import { compareDateOnly, type DateOnly } from "./date-utils";
import type { PlanActivityView, ScheduledActivityView } from "./planner-model";
import { UnscheduledTray } from "./unscheduled-tray";
import { RecordedHours } from "./recorded-hours";

export function DayView({
  date,
  events,
  activities,
  learningActivities,
  hoursRows,
  unscheduled,
  kids,
  onPressEvent,
  onToggleActivity,
  onToggleLearningActivity,
  onScheduleActivity,
}: {
  date: DateOnly;
  events: FamilyEventRecord[];
  activities: ScheduledActivityView[];
  learningActivities: PlannerLearningActivityRecord[];
  hoursRows: HoursLogRow[];
  unscheduled: PlanActivityView[];
  kids: ChildRecord[];
  onPressEvent?: (event: FamilyEventRecord) => void;
  onToggleActivity: (activity: ScheduledActivityView) => Promise<void>;
  onToggleLearningActivity: (activity: PlannerLearningActivityRecord) => Promise<void>;
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
        learningActivities={learningActivities.filter(
          (activity) => activity.activityDate === date,
        )}
        kids={kids}
        onPressEvent={onPressEvent}
        onToggleActivity={onToggleActivity}
        onToggleLearningActivity={onToggleLearningActivity}
        showWeekday={false}
      />
      <RecordedHours rows={hoursRows.filter((row) => row.happenedOn === date)} kids={kids} />
      <UnscheduledTray activities={unscheduled} onSchedule={onScheduleActivity} />
    </View>
  );
}
