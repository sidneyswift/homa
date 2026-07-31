import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { toggleActivityCheck } from "../../lib/child-plans";
import { scheduleActivity } from "../../lib/plan-schedule";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";
import { MaterialCard } from "../chat/material-card";
import { useFamilyData } from "../family/use-family-data";
import {
  addDays,
  formatWeekRangeLabel,
  startOfWeek,
  todayDateOnly,
  type DateOnly,
} from "../planner/date-utils";
import {
  buildScheduledActivities,
  buildUnscheduledActivities,
  type PlanActivityView,
  type ScheduledActivityView,
} from "../planner/planner-model";
import { ScheduleActivitySheet } from "../planner/schedule-activity-sheet";
import { usePlannerData } from "../planner/use-planner-data";
import { WeekView } from "../planner/week-view";
import type { MaterialCardPayload, OverlaySignal } from "./overlay-model";

/**
 * The voice screen's overlay layer: one signal at a time. Planner and
 * material signals slide up as a transparent-Modal sheet (the
 * schedule-activity-sheet chassis: warm scrim, rounded top, slide-up),
 * covering about 65% of the screen so the character stays visible above
 * it. Receipts are not sheets: they render as a small top toast strip
 * that dismisses itself after about four seconds.
 *
 * The law from the bar doc holds here: a tool output is an open/refresh
 * signal, never the data source. The planner body mounts the real week
 * view driven by usePlannerData (the parent's own RLS reads) and
 * refetches when refreshCount increments; the material sheet shows the
 * same MaterialCard chat renders, from the same payload.
 */

type ReceiptSignal = Extract<OverlaySignal, { kind: "receipt" }>;

const SCRIM_COLOR = "rgba(51,42,33,0.42)";
const RECEIPT_DISMISS_MS = 4000;
/** Swipe-down travel on the grab handle that reads as "close". */
const DISMISS_DRAG_PX = 48;

export function OverlayHost({
  signal,
  onDismiss,
  float,
}: {
  signal: OverlaySignal | null;
  onDismiss: () => void;
  /** A live element (the character puck) rendered ABOVE the scrim,
   *  centered in the strip over the sheet, at full vibrancy. Under the
   *  scrim it would dim to background chrome and read as switched off. */
  float?: ReactNode;
}) {
  if (signal === null) return null;
  if (signal.kind === "receipt") {
    return <ReceiptToast signal={signal} onDismiss={onDismiss} />;
  }
  if (signal.kind === "material") {
    return (
      <OverlaySheet
        onDismiss={onDismiss}
        accessibilityLabel="Your new material"
        float={float}
      >
        <MaterialOverlayBody material={signal.material} />
      </OverlaySheet>
    );
  }
  return (
    <OverlaySheet
      onDismiss={onDismiss}
      accessibilityLabel="The week planner"
      float={float}
    >
      <PlannerOverlayBody refreshCount={signal.refreshCount} />
    </OverlaySheet>
  );
}

/** The transparent-sheet chassis from schedule-activity-sheet.tsx: warm
 * scrim, rounded top, native slide-up. Dismiss via scrim tap or a
 * swipe down on the grab handle. */
function OverlaySheet({
  onDismiss,
  accessibilityLabel,
  float,
  children,
}: {
  onDismiss: () => void;
  accessibilityLabel: string;
  float?: ReactNode;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  // Swipe-down on the grab handle, via the View's own responder props
  // (no PanResponder: its create-with-closures shape trips the
  // react-hooks/refs rule). The start Y lives in a ref touched only
  // inside handlers.
  const dragStartY = useRef<number | null>(null);

  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? "fade" : "slide"}
      onRequestClose={onDismiss}
    >
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: SCRIM_COLOR }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          {float ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: insets.top + space.md,
                bottom: space.md,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {float}
            </View>
          ) : null}
        </Pressable>
        <View
          accessibilityLabel={accessibilityLabel}
          style={{
            height: "65%",
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom,
            ...shadows.md,
          }}
        >
          <View
            onStartShouldSetResponder={() => true}
            onResponderGrant={(event) => {
              dragStartY.current = event.nativeEvent.pageY;
            }}
            onResponderRelease={(event) => {
              const startY = dragStartY.current;
              dragStartY.current = null;
              if (startY !== null && event.nativeEvent.pageY - startY > DISMISS_DRAG_PX) {
                onDismiss();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Swipe down to close"
            style={{ alignItems: "center", paddingTop: space.sm, paddingBottom: space.xs }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.border,
              }}
            />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** The real planner week, the same components and RLS reads the Planner
 * tab uses. The signal only opens and refreshes it. */
function PlannerOverlayBody({ refreshCount }: { refreshCount: number }) {
  const { family, children, loading: familyLoading } = useFamilyData();
  const weekStart = useMemo(() => startOfWeek(todayDateOnly()), []);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const { events, scheduleRows, childPlans, loading, reload } = usePlannerData(
    family?.id ?? null,
    children,
    weekStart,
    weekEnd,
  );
  const [schedulingActivity, setSchedulingActivity] =
    useState<PlanActivityView | null>(null);

  // Each plan write Homa streams bumps refreshCount; the refetch shows
  // the write through the parent's own read, never the tool output.
  const seenRefreshCount = useRef(refreshCount);
  useEffect(() => {
    if (refreshCount === seenRefreshCount.current) return;
    seenRefreshCount.current = refreshCount;
    void reload();
  }, [refreshCount, reload]);

  const scheduledActivities = useMemo(
    () => buildScheduledActivities(scheduleRows, childPlans, children),
    [scheduleRows, childPlans, children],
  );
  const unscheduled = useMemo(
    () => buildUnscheduledActivities(childPlans, scheduleRows, children),
    [childPlans, scheduleRows, children],
  );

  async function handleToggleActivity(activity: ScheduledActivityView) {
    await toggleActivityCheck(
      activity.childId,
      activity.subjectId,
      activity.week,
      activity.activityIndex,
      !activity.done,
    );
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
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.md, paddingBottom: space.xs, gap: 2 }}>
        <Text
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSize.lg,
            color: colors.textStrong,
          }}
        >
          This week
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textMuted,
          }}
        >
          {formatWeekRangeLabel(weekStart)}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: space.md, paddingTop: space.xs, gap: space.md }}
      >
        {familyLoading || (loading && events.length === 0 && scheduleRows.length === 0) ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <WeekView
            weekStart={weekStart}
            events={events}
            activities={scheduledActivities}
            unscheduled={unscheduled}
            kids={children}
            // Event editing lives on the Planner tab; this overlay is a
            // quick look while she keeps talking.
            onPressEvent={() => undefined}
            onToggleActivity={(activity) => void handleToggleActivity(activity)}
            onScheduleActivity={setSchedulingActivity}
          />
        )}
      </ScrollView>
      <ScheduleActivitySheet
        activity={schedulingActivity}
        initialDate={todayDateOnly()}
        onSchedule={(date) => void handleScheduleActivity(date)}
        onClose={() => setSchedulingActivity(null)}
      />
    </View>
  );
}

/** The same card chat renders, from the same payload. */
function MaterialOverlayBody({ material }: { material: MaterialCardPayload }) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}
    >
      <MaterialCard material={material} />
    </ScrollView>
  );
}

/** A small top toast, not a sheet: it never covers the character and
 * lets itself out after a few seconds. Tap to dismiss it sooner. */
function ReceiptToast({
  signal,
  onDismiss,
}: {
  signal: ReceiptSignal;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  // The timer keys on the signal, not the callback: a parent re-render
  // mid-stream must not restart the four seconds.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), RECEIPT_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [signal.key]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + space.sm,
        left: space.md,
        right: space.md,
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={signal.summary}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          maxWidth: "100%",
          backgroundColor: colors.card,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          paddingHorizontal: space.md,
          paddingVertical: 10,
          ...shadows.md,
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: colors.sage,
          }}
        />
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fontFamilies.bodyMedium,
            fontSize: fontSize.sm,
            color: colors.textBody,
            flexShrink: 1,
          }}
        >
          {signal.summary}
        </Text>
      </Pressable>
    </View>
  );
}
