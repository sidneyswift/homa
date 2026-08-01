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
import { MaterialShareComposer } from "../materials/material-share-composer";
import { QuestionCard } from "../chat/question-card";
import type { QuestionCardData } from "../chat/question-card-model";
import { useFamilyData } from "../family/use-family-data";
import { EntryRow } from "../hours/entry-row";
import {
  computeChildTotals,
  effectiveTimeZone,
  toHoursEntries,
} from "../hours/hours-view";
import { TotalsCard } from "../hours/totals-card";
import { useHoursData } from "../hours/use-hours-data";
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
import type { MonthPlanPreview } from "../planner/month-plan-preview-model";
import { ScheduleActivitySheet } from "../planner/schedule-activity-sheet";
import { usePlannerData } from "../planner/use-planner-data";
import { WeekView } from "../planner/week-view";
import type {
  MaterialCardPayload,
  OverlaySignal,
  ReceiptSignal,
} from "./overlay-model";
import type { StateRecordDocument } from "../../lib/state-records";
import { StateRecordsCard } from "../state-records/state-records-card";

/**
 * The voice screen's overlay layer: one signal at a time. Planner,
 * material, question, and hours signals slide up as a transparent-Modal
 * sheet (the schedule-activity-sheet chassis: warm scrim, rounded top,
 * slide-up), covering about 65% of the screen so the character stays
 * visible above it. Receipts are not sheets: they render as a small top
 * toast strip that dismisses itself after about four seconds, or hands
 * itself to the screen on tap (onReceiptPress).
 *
 * The law from the bar doc holds here: a tool output is an open/refresh
 * signal, never the data source. The planner body mounts the real week
 * view driven by usePlannerData (the parent's own RLS reads) and
 * refetches when refreshCount increments; the material sheet shows the
 * same MaterialCard chat renders, from the same payload; the question
 * sheet is chat's own QuestionCard, whose answer goes back out through
 * onAnswer as the one composed message; the hours sheet reads the real
 * record through useHoursData.
 */

const SCRIM_COLOR = "rgba(51,42,33,0.42)";
const RECEIPT_DISMISS_MS = 4000;
/** Swipe-down travel on the grab handle that reads as "close". */
const DISMISS_DRAG_PX = 48;
/** The hours sheet is a quick look, not the record: the freshest few
 *  entries under the totals, everything else on the Hours tab. */
const RECENT_HOURS_ENTRIES = 10;

export function OverlayHost({
  signal,
  onDismiss,
  onAnswer,
  onReceiptPress,
  float,
  onMaterialAction,
  onStateRecordOpen,
  onStateRecordReady,
  printNotice,
}: {
  signal: OverlaySignal | null;
  onDismiss: () => void;
  /** Receives the composed answer message when the parent finishes a
   *  question sheet (QuestionCard composes it via composeAnswerMessage,
   *  the same one message chat sends); the screen sends it as her turn. */
  onAnswer?: (message: string) => void;
  /** A tap on a receipt toast hands the signal to the screen and stops
   *  the toast's self-dismiss timer; the screen's response (opening a
   *  sheet replaces the toast, or dismissing it) is the exit. Absent,
   *  a tap simply dismisses, as before. */
  onReceiptPress?: (signal: ReceiptSignal) => void;
  /** A live element (the character puck) rendered ABOVE the scrim,
   *  centered in the strip over the sheet, at full vibrancy. Under the
   *  scrim it would dim to background chrome and read as switched off. */
  float?: ReactNode;
  onMaterialAction?: (
    action: "print" | "share" | "keep" | "change" | "earlier"
  ) => void;
  onStateRecordOpen?: (document: StateRecordDocument) => void;
  onStateRecordReady?: (message: string) => void;
  printNotice?: string | null;
}) {
  if (signal === null) return null;
  if (signal.kind === "receipt") {
    return (
      <ReceiptToast
        signal={signal}
        onDismiss={onDismiss}
        onPress={onReceiptPress}
      />
    );
  }
  if (signal.kind === "material") {
    return (
      <OverlaySheet
        onDismiss={onDismiss}
        accessibilityLabel="Your new material"
        float={float}
      >
        <MaterialOverlayBody
          material={signal.material}
          shareRequest={signal.shareRequest}
          onAction={onMaterialAction}
          printNotice={printNotice}
        />
      </OverlaySheet>
    );
  }
  if (signal.kind === "question") {
    return (
      <OverlaySheet
        onDismiss={onDismiss}
        accessibilityLabel="Homa has a question"
        // Scrim tap still closes (never a gate), but the handle says
        // what closing costs so a half-answered card is never lost to
        // an accidental reach for a generic "close".
        handleLabel="Close without answering"
        float={float}
      >
        <QuestionOverlayBody
          card={signal.card}
          onAnswer={onAnswer}
          onDismiss={onDismiss}
        />
      </OverlaySheet>
    );
  }
  if (signal.kind === "state_records") {
    return (
      <OverlaySheet
        onDismiss={onDismiss}
        accessibilityLabel="State records"
        float={float}
      >
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
          <StateRecordsCard
            action={signal.action}
            onOpenDocument={(document) => onStateRecordOpen?.(document)}
            onReady={onStateRecordReady}
          />
        </ScrollView>
      </OverlaySheet>
    );
  }
  if (signal.kind === "monthPlan") {
    return (
      <OverlaySheet
        onDismiss={onDismiss}
        accessibilityLabel="Month plan preview"
        handleLabel="Close preview"
        float={float}
      >
        <MonthPlanPreviewBody
          preview={signal.preview}
          onApprove={() => {
            onAnswer?.("Approve this month plan exactly as shown.");
            onDismiss();
          }}
          onChange={onDismiss}
        />
      </OverlaySheet>
    );
  }
  if (signal.kind === "hours") {
    return (
      <OverlaySheet
        onDismiss={onDismiss}
        accessibilityLabel="Hours logged"
        float={float}
      >
        <HoursOverlayBody />
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

function shortDate(value: string): string {
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function MonthPlanPreviewBody({
  preview,
  onApprove,
  onChange,
}: {
  preview: MonthPlanPreview;
  onApprove: () => void;
  onChange: () => void;
}) {
  const hasUnresolvedChoices = preview.unresolvedChoices.length > 0;
  const hasOpenItems =
    preview.conflicts.length > 0
    || preview.unscheduledItems.length > 0
    || hasUnresolvedChoices;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm, gap: 3 }}>
        <Text
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSize.xl,
            color: colors.textStrong,
          }}
        >
          {preview.title}
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textMuted,
          }}
        >
          {`${preview.revision === 1 ? "New month preview" : "Updated month preview"} · Nothing is on the Planner yet`}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: space.xl,
          gap: space.md,
        }}
      >
        {preview.restoredFrom ? (
          <PreviewNotice
            title="Showing your earlier plan"
            body="Your later changes are still available. Ask Homa to bring them back."
            tone="sage"
          />
        ) : null}
        {preview.children.map((child) => (
          <View key={child.childId} style={{ gap: space.sm }}>
            <Text
              style={{
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.lg,
                color: colors.textStrong,
              }}
            >
              {child.childName}
            </Text>
            {child.weeks.map((week) => (
              <View
                key={week.week}
                style={{
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  backgroundColor: colors.card,
                  padding: space.md,
                  gap: space.sm,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
                  <Text
                    style={{
                      fontFamily: fontFamilies.bodyBold,
                      fontSize: fontSize.sm,
                      color: colors.textStrong,
                    }}
                  >
                    {`Week ${week.week}`}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      flexShrink: 1,
                      fontFamily: fontFamilies.bodyMedium,
                      fontSize: fontSize.xs,
                      color: colors.textMuted,
                    }}
                  >
                    {week.focus}
                  </Text>
                </View>
                {week.activities.map((activity, index) => (
                  <View key={`${week.week}.${index}`} style={{ flexDirection: "row", gap: space.sm }}>
                    <View
                      style={{
                        marginTop: 7,
                        width: 6,
                        height: 6,
                        borderRadius: radius.pill,
                        backgroundColor: activity.scheduledDate ? colors.sage : colors.gold,
                      }}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          fontFamily: fontFamilies.body,
                          fontSize: fontSize.sm,
                          lineHeight: fontSize.sm * 1.45,
                          color: colors.textBody,
                        }}
                      >
                        {activity.text}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fontFamilies.bodyMedium,
                          fontSize: fontSize.xs,
                          color: colors.textSubtle,
                        }}
                      >
                        {[
                          activity.scheduledDate ? shortDate(activity.scheduledDate) : "Pick a day",
                          activity.reusedMaterialId ? "From your Binder" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
        {preview.conflicts.length > 0 ? (
          <PreviewNotice
            title="Dates that overlap"
            body={preview.conflicts
              .map(
                (conflict) =>
                  `${shortDate(conflict.scheduledDate)}: ${conflict.childName}'s ${conflict.activity} overlaps ${conflict.commitment}.`,
              )
              .join("\n")}
            tone="gold"
          />
        ) : null}
        {preview.unscheduledItems.length > 0 ? (
          <PreviewNotice
            title="Still needs a day"
            body={preview.unscheduledItems.join("\n")}
            tone="gold"
          />
        ) : null}
        {preview.unresolvedChoices.length > 0 ? (
          <PreviewNotice
            title="Choices for you"
            body={preview.unresolvedChoices.join("\n")}
            tone="gold"
          />
        ) : null}
        {!hasOpenItems ? (
          <PreviewNotice
            title="Ready to approve"
            body="You can approve this month or keep talking to change it."
            tone="sage"
          />
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {hasUnresolvedChoices ? (
            <MaterialAction label="Tell Homa your choices" onPress={onChange} primary />
          ) : (
            <MaterialAction label="Approve this month" onPress={onApprove} primary />
          )}
          <MaterialAction label="Tell Homa what to change" onPress={onChange} />
        </View>
      </ScrollView>
    </View>
  );
}

function PreviewNotice({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "sage" | "gold";
}) {
  return (
    <View
      style={{
        borderRadius: radius.md,
        padding: space.md,
        gap: space.xs,
        backgroundColor: tone === "sage" ? colors.sageSoft : colors.goldSoft,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: fontSize.sm,
          color: colors.textStrong,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          lineHeight: fontSize.sm * 1.45,
          color: colors.textBody,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

/** The transparent-sheet chassis from schedule-activity-sheet.tsx: warm
 * scrim, rounded top, native slide-up. Dismiss via scrim tap or a
 * swipe down on the grab handle. */
function OverlaySheet({
  onDismiss,
  accessibilityLabel,
  handleLabel = "Swipe down to close",
  float,
  children,
}: {
  onDismiss: () => void;
  accessibilityLabel: string;
  /** The grab handle's spoken label. The question sheet names the cost
   *  of leaving ("Close without answering"). */
  handleLabel?: string;
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
            accessibilityLabel={handleLabel}
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
function MaterialOverlayBody({
  material,
  shareRequest,
  onAction,
  printNotice,
}: {
  material: MaterialCardPayload;
  shareRequest?: Extract<OverlaySignal, { kind: "material" }>["shareRequest"];
  onAction?: (action: "print" | "share" | "keep" | "change" | "earlier") => void;
  printNotice?: string | null;
}) {
  const { family } = useFamilyData();
  return (
    <ScrollView
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xl, gap: space.sm }}
    >
      <MaterialCard material={material} />
      {shareRequest ? (
        <MaterialShareComposer key={shareRequest.materialId} request={shareRequest} familyId={family?.id} />
      ) : null}
      {printNotice ? (
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
          {printNotice}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
        <MaterialAction label="Print" onPress={() => onAction?.("print")} primary />
        <MaterialAction
          label="Share through an app"
          onPress={() => onAction?.("share")}
        />
        {material.status !== "final" ? (
          <MaterialAction label="Keep" onPress={() => onAction?.("keep")} />
        ) : null}
        <MaterialAction label="Change" onPress={() => onAction?.("change")} />
        {material.revisesId ? (
          <MaterialAction label="Earlier" onPress={() => onAction?.("earlier")} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function MaterialAction({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: "center",
        borderRadius: radius.pill,
        paddingHorizontal: space.md,
        backgroundColor: primary ? colors.brand : colors.card,
        borderWidth: 1,
        borderColor: primary ? colors.brand : colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: fontSize.sm,
          color: primary ? colors.onBrand : colors.textBody,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The same stepped card chat renders (question-card.tsx). Its taps
 * compose the one answer message through composeAnswerMessage inside
 * the card, so voice sends the identical message chat would; answering
 * closes the sheet, and "Type something else" closes it too, dropping
 * her at the composer that is always under the sheet. */
function QuestionOverlayBody({
  card,
  onAnswer,
  onDismiss,
}: {
  card: QuestionCardData;
  onAnswer?: (message: string) => void;
  onDismiss: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}
      keyboardShouldPersistTaps="handled"
    >
      <QuestionCard
        card={card}
        active
        onSendAnswers={(message) => {
          // Chat's own empty-answer guard (chat-session.tsx): nothing
          // to say means no turn, just back to the composer.
          if (message.trim().length > 0) onAnswer?.(message);
          onDismiss();
        }}
        onTypeInstead={onDismiss}
      />
    </ScrollView>
  );
}

/** A quick look at the compliance record, through the same components
 * and RLS reads the Hours tab uses (use-hours-data.ts): every child's
 * totals up top, then the freshest entries. Read-only on purpose. */
function HoursOverlayBody() {
  const { family, children, loading: familyLoading } = useFamilyData();
  const { rows, loading: hoursLoading, error } = useHoursData(family?.id ?? null);
  const timeZone = effectiveTimeZone(family?.time_zone);
  const entries = useMemo(() => toHoursEntries(rows, children), [rows, children]);
  const totals = useMemo(
    () => computeChildTotals(entries, children, new Date(), timeZone),
    [entries, children, timeZone],
  );
  // Rows already arrive newest-happened_on-first (the query's order).
  const recent = entries.slice(0, RECENT_HOURS_ENTRIES);
  const loading = familyLoading || (hoursLoading && rows.length === 0);

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
          Hours
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textMuted,
          }}
        >
          School time Homa has on the record.
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: space.md, paddingTop: space.xs, gap: space.sm }}
      >
        {loading ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : error ? (
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            {"That didn't load. The Hours tab has the full record."}
          </Text>
        ) : recent.length === 0 ? (
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            Nothing logged yet. Tell Homa about school time and it shows
            up here.
          </Text>
        ) : (
          <>
            {totals.map((total) => {
              const kidIndex = children.findIndex(
                (child) => child.id === total.childId,
              );
              return (
                <TotalsCard
                  key={total.childId}
                  total={total}
                  kidIndex={Math.max(0, kidIndex)}
                />
              );
            })}
            <Text
              style={{
                marginTop: space.xs,
                fontFamily: fontFamilies.bodyBold,
                fontSize: 11,
                letterSpacing: 0.4,
                color: colors.textSubtle,
                textTransform: "uppercase",
              }}
            >
              Recent
            </Text>
            {recent.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                showChild={children.length > 1}
                // Editing lives on the Hours tab; this sheet is a quick
                // look while she keeps talking (the planner body's own
                // onPressEvent idiom).
                onEdit={() => undefined}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** A small top toast, not a sheet: it never covers the character and
 * lets itself out after a few seconds. A tap dismisses it sooner, or,
 * when the screen listens (onPress), hands it the receipt instead: the
 * timer stops so the toast holds still while the screen responds. */
function ReceiptToast({
  signal,
  onDismiss,
  onPress,
}: {
  signal: ReceiptSignal;
  onDismiss: () => void;
  onPress?: (signal: ReceiptSignal) => void;
}) {
  const insets = useSafeAreaInsets();
  // The timer keys on the signal, not the callback: a parent re-render
  // mid-stream must not restart the four seconds.
  const onDismissRef = useRef(onDismiss);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    timerRef.current = setTimeout(
      () => onDismissRef.current(),
      RECEIPT_DISMISS_MS,
    );
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [signal.key]);

  function handlePress() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (onPress) onPress(signal);
    else onDismiss();
  }

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
        onPress={handlePress}
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
