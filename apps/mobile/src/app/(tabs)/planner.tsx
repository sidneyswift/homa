import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { InlineError } from "../../components/ui/inline-error";
import { Icon } from "../../components/design/icon";
import { IconButton } from "../../components/ui/icon-button";
import { LoadingStatus } from "../../components/ui/loading-status";
import { toggleActivityCheck } from "../../lib/child-plans";
import { PlanActivityCheckConflictError } from "../../lib/plan-check-mutation";
import { createIdempotencyKey } from "../../lib/idempotency-key";
import {
  createFamilyEvent,
  deleteFamilyEvent,
  deleteFamilyEventOccurrence,
  familyEventChildIds,
  moveFamilyEventOccurrence,
  updateFamilyEvent,
  type FamilyEventRecord,
} from "../../lib/family-events";
import { scheduleActivity } from "../../lib/plan-schedule";
import { useFamilyData } from "../../features/family/use-family-data";
import { HoursSurface } from "./hours";
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
  draftFromOccurrence,
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

type PlannerViewMode = "day" | "week" | "month" | "hours";

/**
 * Planner: one surface for day, week, month, and the Hours record, per
 * founder direction 2026-08-02. Calendar views use family_events plus
 * plan_activity_schedule, both
 * genuinely writable tables (full RLS insert/update/delete for
 * authenticated family members, confirmed, not assumed). Check-offs use
 * set_plan_activity_check, an atomic operation that rejects a positional
 * key when either its exact text or its plan revision is stale.
 *
 * Web has no direct UI to schedule a plan activity onto a real day at
 * all today (only the schedule_plan_activity chat tool can); the
 * "not yet on a day" tray + ScheduleActivitySheet here are mobile's own
 * addition, using the same direct upsert schedulePlanActivityCaller
 * already does under the caller's own session on web.
 */
export default function PlannerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ view?: string | string[] }>();
  const { family, children, loading: familyLoading } = useFamilyData();
  const initialView = Array.isArray(params.view) ? params.view[0] : params.view;
  const viewMode: PlannerViewMode =
    initialView === "week" || initialView === "month" || initialView === "hours"
      ? initialView
      : "day";
  const [anchorDate, setAnchorDate] = useState<DateOnly>(todayDateOnly());
  const [filterChildId, setFilterChildId] = useState<string | null>(null);
  const [composerDraft, setComposerDraft] = useState<EventComposerDraft | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<FamilyEventRecord | null>(null);
  const [recurringEditScope, setRecurringEditScope] = useState<"occurrence" | "series" | null>(null);
  const [creatingEventId, setCreatingEventId] = useState<string | null>(null);
  const [schedulingActivity, setSchedulingActivity] = useState<PlanActivityView | null>(null);
  const [calendarExportOpen, setCalendarExportOpen] = useState(false);

  function setViewMode(next: PlannerViewMode) {
    router.setParams({ view: next });
  }

  const range = useMemo(() => monthGridRange(anchorDate), [anchorDate]);
  const {
    events,
    scheduleRows,
    childPlans,
    hoursRows,
    loading,
    error: plannerError,
    reload,
    reconcileAfterAmbiguousWrite,
    applyActivityCheck,
  } = usePlannerData(
    family?.id ?? null,
    children,
    range.start,
    range.end,
  );
  const latestReload = useRef(reload);
  const hasBlurredPlanner = useRef(false);
  useEffect(() => {
    latestReload.current = reload;
  }, [reload]);
  // Only a real navigation blur arms refocus refresh. Effect cleanup does
  // not, so React Strict Mode cannot duplicate the initial Planner load.
  useEffect(
    () => navigation.addListener("blur", () => {
      hasBlurredPlanner.current = true;
    }),
    [navigation],
  );
  useFocusEffect(useCallback(() => {
    if (!hasBlurredPlanner.current) return;
    hasBlurredPlanner.current = false;
    void latestReload.current();
  }, []));

  const filteredEvents = useMemo(
    () => filterChildId
      ? events.filter((event) => {
          const childIds = familyEventChildIds(event);
          return childIds.length === 0 || childIds.includes(filterChildId);
        })
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
  const filteredHoursRows = useMemo(
    () => filterChildId
      ? hoursRows.filter((row) => row.childId === null || row.childId === filterChildId)
      : hoursRows,
    [filterChildId, hoursRows],
  );
  const visibleRange = useMemo(() => {
    if (viewMode === "hours") return { start: anchorDate, end: anchorDate };
    if (viewMode === "day") return { start: anchorDate, end: anchorDate };
    if (viewMode === "week") {
      const start = startOfWeek(anchorDate);
      return { start, end: addDays(start, 6) };
    }
    return monthGridRange(anchorDate);
  }, [anchorDate, viewMode]);
  const calendarExportItems = useMemo(() => {
    const timeZone = family?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const eventItems = [...new Map(filteredEvents
      .filter((event) => event.starts_on <= visibleRange.end && event.ends_on >= visibleRange.start)
      .map((event) => [event.id, event])).values()]
      .map((event) => {
        const childNames = familyEventChildIds(event)
          .map((childId) => children.find((child) => child.id === childId)?.name)
          .filter((name): name is string => Boolean(name));
        return familyEventExportItem(
          event,
          childNames.length > 0 ? childNames.join(" + ") : null,
          timeZone,
          event.recurrence_rule,
        );
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

  const viewTabs = (
    <View style={{ flexDirection: "row", backgroundColor: colors.surfaceSunken, borderRadius: radius.pill, padding: 3 }}>
      <ViewModeTab label="Day" active={viewMode === "day"} onPress={() => setViewMode("day")} />
      <ViewModeTab label="Week" active={viewMode === "week"} onPress={() => setViewMode("week")} />
      <ViewModeTab label="Month" active={viewMode === "month"} onPress={() => setViewMode("month")} />
      <ViewModeTab label="Hours" active={viewMode === "hours"} onPress={() => setViewMode("hours")} />
    </View>
  );

  async function handleToggleActivity(activity: PlanActivityView) {
    let outcome;
    try {
      outcome = await toggleActivityCheck({
        childId: activity.childId,
        subjectId: activity.subjectId,
        checkKey: activity.checkKey,
        done: !activity.done,
        expectedText: activity.text,
        planRevision: activity.planRevision,
      });
    } catch (cause) {
      await reconcileAfterAmbiguousWrite();
      throw cause;
    }
    if (outcome.status === "applied") {
      applyActivityCheck(activity, outcome);
      return;
    }
    await reload();
    throw new PlanActivityCheckConflictError(outcome);
  }

  function openNewEventComposer(date: DateOnly) {
    setEditingEventId(null);
    setEditingEvent(null);
    setRecurringEditScope(null);
    setCreatingEventId(createIdempotencyKey());
    setComposerDraft(blankDraft(date));
  }

  function openEditEventComposer(event: FamilyEventRecord) {
    setEditingEventId(event.id);
    setEditingEvent(event);
    setCreatingEventId(null);
    if (event.recurrence_rule) {
      setRecurringEditScope("occurrence");
      setComposerDraft(draftFromOccurrence(event));
    } else {
      setRecurringEditScope(null);
      setComposerDraft(draftFromEvent(event));
    }
  }

  function changeRecurringEditScope(scope: "occurrence" | "series") {
    if (!editingEvent?.recurrence_rule) return;
    setRecurringEditScope(scope);
    setComposerDraft(
      scope === "occurrence"
        ? draftFromOccurrence(editingEvent)
        : draftFromEvent(editingEvent),
    );
  }

  async function handleSaveEvent() {
    if (!composerDraft || !family) {
      throw new Error("planner event context is unavailable");
    }
    const input = draftToInput(composerDraft);
    if (editingEventId && editingEvent?.recurrence_rule && recurringEditScope === "occurrence") {
      await moveFamilyEventOccurrence(
        editingEventId,
        family.id,
        editingEvent.original_occurrence_on ?? editingEvent.starts_on,
        {
          startsOn: composerDraft.startsOn,
          endsOn: composerDraft.endsOn,
          startTime: composerDraft.hasTime ? composerDraft.startTime : null,
          endTime: composerDraft.hasTime ? composerDraft.endTime : null,
        },
      );
    } else if (editingEventId) {
      await updateFamilyEvent(editingEventId, family.id, input);
    } else {
      if (!creatingEventId) {
        throw new Error("planner create identity is unavailable");
      }
      await createFamilyEvent(creatingEventId, family.id, input);
    }
    setComposerDraft(null);
    setEditingEventId(null);
    setEditingEvent(null);
    setRecurringEditScope(null);
    setCreatingEventId(null);
    await reload();
  }

  async function handleDeleteEvent() {
    if (!editingEventId || !family) {
      throw new Error("planner delete context is unavailable");
    }
    if (editingEvent?.recurrence_rule && recurringEditScope === "occurrence") {
      await deleteFamilyEventOccurrence(
        editingEventId,
        family.id,
        editingEvent.original_occurrence_on ?? editingEvent.starts_on,
      );
    } else {
      await deleteFamilyEvent(editingEventId);
    }
    setComposerDraft(null);
    setEditingEventId(null);
    setEditingEvent(null);
    setRecurringEditScope(null);
    setCreatingEventId(null);
    await reload();
  }

  async function handleScheduleActivity(date: DateOnly) {
    if (!family || !schedulingActivity) {
      throw new Error("planner schedule context is unavailable");
    }
    await scheduleActivity({
      familyId: family.id,
      childId: schedulingActivity.childId,
      subjectId: schedulingActivity.subjectId,
      week: schedulingActivity.week,
      activityIndex: schedulingActivity.activityIndex,
      planRevision: schedulingActivity.planRevision,
      expectedText: schedulingActivity.text,
      scheduledDate: date,
    });
    setSchedulingActivity(null);
    await reload();
  }

  if (viewMode === "hours") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
        <View style={{ padding: space.md, paddingBottom: 0 }}>{viewTabs}</View>
        <HoursSurface embedded />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      <View style={{ padding: space.md, gap: space.sm }}>
        {viewTabs}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <IconButton label="Show the previous date range" onPress={goPrevious}>
            <Icon name="back" size={24} color={colors.textBody} />
          </IconButton>
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Go to today. Showing ${headerLabel()}`}
            onPress={goToday}
            style={{ minHeight: 44, flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
              {headerLabel()}
            </Text>
          </Pressable>
          <IconButton label="Show the next date range" onPress={goNext}>
            <Icon name="next" size={24} color={colors.textBody} />
          </IconButton>
        </View>

        {children.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            <FilterChip label="Whole family" active={filterChildId === null} onPress={() => setFilterChildId(null)} />
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
          accessibilityLabel="Choose Planner items to copy to device calendar"
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
          <Icon name="calendar" size={20} color={colors.action} />
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
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
            <LoadingStatus label="Loading your planner" />
          </View>
        ) : null}

        {plannerError ? (
          <InlineError message="Planner couldn't refresh. Your saved items are safe. Pull down to try again." />
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
            kids={children}
            onPressEvent={openEditEventComposer}
            onToggleActivity={handleToggleActivity}
            onScheduleActivity={setSchedulingActivity}
          />
        ) : (
          <DayView
            date={anchorDate}
            events={filteredEvents}
            activities={filteredActivities}
            hoursRows={filteredHoursRows}
            unscheduled={filteredUnscheduled}
            kids={children}
            onPressEvent={openEditEventComposer}
            onToggleActivity={handleToggleActivity}
            onScheduleActivity={setSchedulingActivity}
          />
        )}
      </ScrollView>

      <IconButton
        label="Add plan item"
        accessibilityHint={`Opens a new plan for ${formatFullDate(anchorDate)}`}
        onPress={() => openNewEventComposer(anchorDate)}
        style={{
          position: "absolute",
          right: space.md,
          bottom: space.md,
          width: 52,
          height: 52,
          borderRadius: radius.pill,
          backgroundColor: colors.action,
          alignItems: "center",
          justifyContent: "center",
          ...shadows.md,
        }}
      >
        <Icon name="add" size={24} color={colors.onBrand} />
      </IconButton>

      {composerDraft ? (
        <EventComposer
          key={`${editingEventId ?? creatingEventId ?? "new"}:${recurringEditScope ?? "single"}`}
          visible
          draft={composerDraft}
          isEditing={editingEventId !== null}
          childrenList={children}
          onChange={setComposerDraft}
          onSave={handleSaveEvent}
          onDelete={editingEventId ? handleDeleteEvent : undefined}
          recurringEditScope={recurringEditScope}
          recurringOriginalDate={
            editingEvent?.original_occurrence_on ?? editingEvent?.starts_on
          }
          onRecurringEditScopeChange={
            recurringEditScope ? changeRecurringEditScope : undefined
          }
          onClose={() => {
            setComposerDraft(null);
            setEditingEventId(null);
            setEditingEvent(null);
            setRecurringEditScope(null);
            setCreatingEventId(null);
          }}
        />
      ) : null}

      <ScheduleActivitySheet
        key={
          schedulingActivity
            ? `${schedulingActivity.childId}.${schedulingActivity.subjectId}.${schedulingActivity.week}.${schedulingActivity.activityIndex}`
            : "scheduler"
        }
        activity={schedulingActivity}
        initialDate={anchorDate}
        onSchedule={handleScheduleActivity}
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
 * Written as four explicit elements rather than VIEW_MODES.map(...):
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
      accessible
      accessibilityRole="tab"
      accessibilityLabel={`${label} planner view`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
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
  const background = active ? colors.action : tone ? tone[0] : colors.card;
  const textColor = active ? colors.onBrand : tone ? tone[1] : colors.textBody;
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Filter planner by ${label}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.xs,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        backgroundColor: background,
        borderWidth: 1,
        borderColor: active ? colors.action : colors.borderSubtle,
      }}
    >
      {active ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name="check" size={16} color={colors.onBrand} />
        </View>
      ) : null}
      <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: textColor }}>{label}</Text>
    </Pressable>
  );
}
