import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { toggleActivityCheck } from "../../lib/child-plans";
import {
  createFamilyEvent,
  deleteFamilyEvent,
  updateFamilyEvent,
  type FamilyEventRecord,
} from "../../lib/family-events";
import { scheduleActivity } from "../../lib/plan-schedule";
import { useFamilyData } from "../../features/family/use-family-data";
import { DayView } from "../../features/planner/day-view";
import { DeviceCalendarExportSheet } from "../../features/planner/device-calendar-export-sheet";
import {
  familyEventExportItem,
  planActivityExportItem,
} from "../../features/planner/device-calendar-export";
import {
  addDays,
  addMonths,
  formatFullDate,
  formatMonthYear,
  formatWeekRangeLabel,
  monthGridRange,
  startOfWeek,
  todayDateOnly,
  type DateOnly,
} from "../../features/planner/date-utils";
import {
  blankDraft,
  draftFromEvent,
  draftToInput,
  EventComposer,
  type EventComposerDraft,
} from "../../features/planner/event-composer";
import { kidTone } from "../../features/planner/kid-tone";
import { MonthView } from "../../features/planner/month-view";
import { buildScheduledActivities, buildUnscheduledActivities, type PlanActivityView } from "../../features/planner/planner-model";
import { ScheduleActivitySheet } from "../../features/planner/schedule-activity-sheet";
import { usePlannerData } from "../../features/planner/use-planner-data";
import { WeekView } from "../../features/planner/week-view";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";

type PlannerViewMode = "day" | "week" | "month";

/**
 * Planner: one surface for what web splits across /app/planner (a
 * Mon-Fri checklist, no real dates) and /app/calendar (the real week
 * grid with family events), per founder direction 2026-07-29. Day/week/
 * month views over family_events + plan_activity_schedule, both
 * genuinely writable tables (full RLS insert/update/delete for
 * authenticated family members, confirmed, not assumed). Check-offs use
 * toggle_plan_activity_check, a new atomic single-key RPC
 * (supabase/migrations/20260729160000_toggle_plan_activity_check.sql):
 * web's own check-off sync replaces the whole progress map per write,
 * a real clobber hazard with a second writer, so mobile doesn't
 * reproduce it.
 *
 * Web has no direct UI to schedule a plan activity onto a real day at
 * all today (only the schedule_plan_activity chat tool can); the
 * "not yet on a day" tray + ScheduleActivitySheet here are mobile's own
 * addition, using the same direct upsert schedulePlanActivityCaller
 * already does under the caller's own session on web.
 */
export default function PlannerScreen() {
  const { family, children, loading: familyLoading } = useFamilyData();
  const [viewMode, setViewMode] = useState<PlannerViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<DateOnly>(todayDateOnly());
  const [filterChildId, setFilterChildId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<EventComposerDraft | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [schedulingActivity, setSchedulingActivity] = useState<PlanActivityView | null>(null);
  const [calendarExportOpen, setCalendarExportOpen] = useState(false);

  const range = useMemo(() => monthGridRange(anchorDate), [anchorDate]);
  const { events, scheduleRows, childPlans, loading, reload } = usePlannerData(
    family?.id ?? null,
    children,
    range.start,
    range.end,
  );

  const filteredChildren = filterChildId ? children.filter((child) => child.id === filterChildId) : children;
  const filteredEvents = useMemo(
    () => filterChildId
      ? events.filter((event) => event.child_id === null || event.child_id === filterChildId)
      : events,
    [events, filterChildId],
  );
  const scheduledActivities = useMemo(
    () => buildScheduledActivities(scheduleRows, childPlans, children),
    [scheduleRows, childPlans, children],
  );
  const filteredActivities = useMemo(
    () => filterChildId
      ? scheduledActivities.filter((activity) => activity.childId === filterChildId)
      : scheduledActivities,
    [filterChildId, scheduledActivities],
  );
  const unscheduled = useMemo(
    () => buildUnscheduledActivities(childPlans, scheduleRows, children),
    [childPlans, scheduleRows, children],
  );
  const filteredUnscheduled = useMemo(
    () => filterChildId
      ? unscheduled.filter((activity) => activity.childId === filterChildId)
      : unscheduled,
    [filterChildId, unscheduled],
  );
  const visibleRange = useMemo(() => {
    if (viewMode === "day") return { start: anchorDate, end: anchorDate };
    if (viewMode === "week") {
      const start = startOfWeek(anchorDate);
      return { start, end: addDays(start, 6) };
    }
    return monthGridRange(anchorDate);
  }, [anchorDate, viewMode]);
  const calendarExportItems = useMemo(() => {
    const timeZone = family?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const eventItems = filteredEvents
      .filter((event) => event.starts_on <= visibleRange.end && event.ends_on >= visibleRange.start)
      .map((event) => {
        const childName = event.child_id
          ? children.find((child) => child.id === event.child_id)?.name ?? "Child"
          : null;
        return familyEventExportItem(event, childName, timeZone);
      });
    const activityItems = filteredActivities
      .filter((activity) => activity.scheduledDate >= visibleRange.start && activity.scheduledDate <= visibleRange.end)
      .map((activity) => planActivityExportItem(activity, timeZone));
    return [...eventItems, ...activityItems];
  }, [children, family?.time_zone, filteredActivities, filteredEvents, visibleRange]);

  function goToday() {
    setAnchorDate(todayDateOnly());
  }

  function goPrevious() {
    if (viewMode === "day") setAnchorDate((date) => addDays(date, -1));
    else if (viewMode === "week") setAnchorDate((date) => addDays(date, -7));
    else setAnchorDate((date) => addMonths(date, -1));
  }

  function goNext() {
    if (viewMode === "day") setAnchorDate((date) => addDays(date, 1));
    else if (viewMode === "week") setAnchorDate((date) => addDays(date, 7));
    else setAnchorDate((date) => addMonths(date, 1));
  }

  function headerLabel(): string {
    if (viewMode === "month") return formatMonthYear(anchorDate);
    if (viewMode === "week") return formatWeekRangeLabel(startOfWeek(anchorDate));
    return formatFullDate(anchorDate);
  }

  async function handleToggleActivity(activity: { childId: string; subjectId: string; week: number; activityIndex: number; done: boolean }) {
    await toggleActivityCheck(activity.childId, activity.subjectId, activity.week, activity.activityIndex, !activity.done);
    void reload();
  }

  function openNewEventComposer(date: DateOnly) {
    setEditingEventId(null);
    setComposerDraft(blankDraft(date));
  }

  function openEditEventComposer(event: FamilyEventRecord) {
    setEditingEventId(event.id);
    setComposerDraft(draftFromEvent(event));
  }

  async function handleSaveEvent() {
    if (!composerDraft || !family) return;
    const input = draftToInput(composerDraft);
    if (editingEventId) {
      await updateFamilyEvent(editingEventId, input);
    } else {
      await createFamilyEvent(family.id, input);
    }
    setComposerDraft(null);
    setEditingEventId(null);
    void reload();
  }

  async function handleDeleteEvent() {
    if (!editingEventId) return;
    await deleteFamilyEvent(editingEventId);
    setComposerDraft(null);
    setEditingEventId(null);
    void reload();
  }

  async function handleScheduleActivity(date: DateOnly) {
    if (!family || !schedulingActivity) return;
    await scheduleActivity({
      familyId: family.id,
      childId: schedulingActivity.childId,
      subjectId: schedulingActivity.subjectId,
      week: schedulingActivity.week,
      activityIndex: schedulingActivity.activityIndex,
      scheduledDate: date,
    });
    setSchedulingActivity(null);
    void reload();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      <View style={{ padding: space.md, gap: space.sm }}>
        <View style={{ flexDirection: "row", backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, padding: 3 }}>
          <ViewModeTab label="Day" active={viewMode === "day"} onPress={() => setViewMode("day")} />
          <ViewModeTab label="Week" active={viewMode === "week"} onPress={() => setViewMode("week")} />
          <ViewModeTab label="Month" active={viewMode === "month"} onPress={() => setViewMode("month")} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={goPrevious} hitSlop={8}>
            <ChevronLeft size={22} color={colors.textBody} />
          </Pressable>
          <Pressable onPress={goToday}>
            <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
              {headerLabel()}
            </Text>
          </Pressable>
          <Pressable onPress={goNext} hitSlop={8}>
            <ChevronRight size={22} color={colors.textBody} />
          </Pressable>
        </View>

        {children.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            <FilterChip label="Everyone" active={filterChildId === null} onPress={() => setFilterChildId(null)} />
            {children.map((child, index) => (
              <FilterChip
                key={child.id}
                label={child.name}
                active={filterChildId === child.id}
                tone={kidTone(index)}
                onPress={() => setFilterChildId(child.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add selected planner items to device calendar"
          onPress={() => setCalendarExportOpen(true)}
          style={{
            alignSelf: "flex-end",
            flexDirection: "row",
            alignItems: "center",
            gap: space.xs,
            minHeight: 44,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          <CalendarPlus size={17} color={colors.brand} />
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.brand }}>
            Add to device calendar
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.md, paddingTop: 0, gap: space.md }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} />}
      >
        {familyLoading || (loading && events.length === 0 && scheduleRows.length === 0) ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : null}

        {viewMode === "month" ? (
          <MonthView
            anchorDate={anchorDate}
            events={filteredEvents}
            activities={filteredActivities}
            onSelectDate={(date) => {
              setAnchorDate(date);
              setViewMode("day");
            }}
          />
        ) : viewMode === "week" ? (
          <WeekView
            weekStart={startOfWeek(anchorDate)}
            events={filteredEvents}
            activities={filteredActivities}
            unscheduled={filteredUnscheduled}
            kids={filteredChildren}
            onPressEvent={openEditEventComposer}
            onToggleActivity={(activity) => void handleToggleActivity(activity)}
            onScheduleActivity={setSchedulingActivity}
          />
        ) : (
          <DayView
            date={anchorDate}
            events={filteredEvents}
            activities={filteredActivities}
            unscheduled={filteredUnscheduled}
            kids={filteredChildren}
            onPressEvent={openEditEventComposer}
            onToggleActivity={(activity) => void handleToggleActivity(activity)}
            onScheduleActivity={setSchedulingActivity}
          />
        )}
      </ScrollView>

      <Pressable
        onPress={() => openNewEventComposer(anchorDate)}
        style={{
          position: "absolute",
          right: space.md,
          bottom: space.md,
          width: 52,
          height: 52,
          borderRadius: radius.pill,
          backgroundColor: colors.brand,
          alignItems: "center",
          justifyContent: "center",
          ...shadows.md,
        }}
      >
        <Plus size={24} color={colors.onBrand} />
      </Pressable>

      {composerDraft ? (
        <EventComposer
          visible
          draft={composerDraft}
          isEditing={editingEventId !== null}
          childrenList={children}
          onChange={setComposerDraft}
          onSave={() => void handleSaveEvent()}
          onDelete={editingEventId ? () => void handleDeleteEvent() : undefined}
          onClose={() => {
            setComposerDraft(null);
            setEditingEventId(null);
          }}
        />
      ) : null}

      <ScheduleActivitySheet
        activity={schedulingActivity}
        initialDate={anchorDate}
        onSchedule={(date) => void handleScheduleActivity(date)}
        onClose={() => setSchedulingActivity(null)}
      />

      {family && calendarExportOpen ? (
        <DeviceCalendarExportSheet
          visible
          familyId={family.id}
          items={calendarExportItems}
          onClose={() => setCalendarExportOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * Written as three explicit elements rather than VIEW_MODES.map(...):
 * the mapped version's third (last) Pressable never received a single
 * tap in the simulator regardless of which mode's label sat there
 * (swapping the array order moved the dead one with it), while the
 * first two always worked. Not chasing that further here; three
 * static elements sidestep it cleanly.
 */
function ViewModeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        alignItems: "center",
        backgroundColor: active ? colors.card : "transparent",
        ...(active ? shadows.sm : {}),
      }}
    >
      <Text
        style={{
          fontFamily: active ? fontFamilies.bodySemibold : fontFamilies.bodyMedium,
          fontSize: fontSize.sm,
          color: active ? colors.textStrong : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  tone,
  onPress,
}: {
  label: string;
  active: boolean;
  tone?: readonly [string, string];
  onPress: () => void;
}) {
  const background = active ? colors.brand : tone ? tone[0] : colors.card;
  const textColor = active ? colors.onBrand : tone ? tone[1] : colors.textBody;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        backgroundColor: background,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.borderSubtle,
      }}
    >
      <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: textColor }}>{label}</Text>
    </Pressable>
  );
}
