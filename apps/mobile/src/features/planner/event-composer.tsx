import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import { reportCrash } from "../../lib/crash-reporting";
import type { ChildRecord } from "../../lib/family";
import {
  familyEventChildIds,
  type FamilyEventInput,
  type FamilyEventRecord,
} from "../../lib/family-events";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import { addDays, formatMonthDay, formatWeekdayShort, type DateOnly } from "./date-utils";

const TIME_STEP_MINUTES = 30;

function formatTimeLabel(time: string): string {
  const [hourString, minute] = time.split(":");
  const hour = Number(hourString);
  const period = hour >= 12 ? "pm" : "am";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${minute}${period}`;
}

function stepTime(time: string, direction: 1 | -1): string {
  const [hour, minute] = time.split(":").map(Number);
  let totalMinutes = hour * 60 + minute + direction * TIME_STEP_MINUTES;
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHour = Math.floor(totalMinutes / 60);
  const nextMinute = totalMinutes % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

function weekday(date: DateOnly): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function DateStepper({
  date,
  disabled,
  stepDays = 1,
  onChange,
}: {
  date: DateOnly;
  disabled: boolean;
  stepDays?: number;
  onChange: (next: DateOnly) => void;
}) {
  const dateLabel = `${formatWeekdayShort(date)}, ${formatMonthDay(date)}`;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surfaceSunken,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous day from ${dateLabel}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(addDays(date, -stepDays))}
        hitSlop={8}
      >
        <ChevronLeft size={20} color={colors.textBody} />
      </Pressable>
      <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
        {formatWeekdayShort(date)}, {formatMonthDay(date)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next day from ${dateLabel}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(addDays(date, stepDays))}
        hitSlop={8}
      >
        <ChevronRight size={20} color={colors.textBody} />
      </Pressable>
    </View>
  );
}

function TimeStepper({
  time,
  disabled,
  onChange,
}: {
  time: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const timeLabel = formatTimeLabel(time);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surfaceSunken,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Earlier than ${timeLabel}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(stepTime(time, -1))}
        hitSlop={8}
      >
        <ChevronLeft size={20} color={colors.textBody} />
      </Pressable>
      <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
        {formatTimeLabel(time)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Later than ${timeLabel}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(stepTime(time, 1))}
        hitSlop={8}
      >
        <ChevronRight size={20} color={colors.textBody} />
      </Pressable>
    </View>
  );
}

export interface EventComposerDraft {
  title: string;
  childIds: string[];
  startsOn: DateOnly;
  endsOn: DateOnly;
  hasTime: boolean;
  startTime: string;
  endTime: string;
  note: string;
  recurrence: FamilyEventRecord["recurrence_rule"];
}

export function draftFromEvent(event: FamilyEventRecord): EventComposerDraft {
  return {
    title: event.title,
    childIds: familyEventChildIds(event),
    startsOn: event.series_starts_on ?? event.starts_on,
    endsOn: event.series_ends_on ?? event.ends_on,
    hasTime: Boolean(event.start_time),
    startTime: event.start_time ?? "09:00",
    endTime: event.end_time ?? "10:00",
    note: event.note ?? "",
    recurrence: event.recurrence_rule,
  };
}

export function blankDraft(date: DateOnly): EventComposerDraft {
  return {
    title: "",
    childIds: [],
    startsOn: date,
    endsOn: date,
    hasTime: false,
    startTime: "09:00",
    endTime: "10:00",
    note: "",
    recurrence: null,
  };
}

export function draftToInput(draft: EventComposerDraft): FamilyEventInput {
  return {
    childIds: draft.childIds,
    title: draft.title,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn,
    startTime: draft.hasTime ? draft.startTime : null,
    endTime: draft.hasTime ? draft.endTime : null,
    note: draft.note || null,
    recurrence: draft.recurrence,
  };
}

/**
 * Create/edit a family_event. Ported in spirit from web's composer
 * (apps/web/app/app/calendar/calendar-view.tsx's slot/event-block
 * composer), simplified to steppers since no native date/time picker is
 * linked into this dev client build yet (that's a real native module,
 * not a pure-JS one like lucide-react-native, so adding it means a
 * fresh `expo run:ios`, not just `pnpm install`).
 */
export function EventComposer({
  visible,
  draft,
  isEditing,
  childrenList,
  onChange,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  draft: EventComposerDraft;
  isEditing: boolean;
  childrenList: ChildRecord[];
  onChange: (next: EventComposerDraft) => void;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [pendingAction, setPendingAction] = useState<"save" | "delete" | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(
    () => isEditing && (
      draft.childIds.length > 0
      || draft.recurrence !== null
      || draft.startsOn !== draft.endsOn
      || draft.note.trim() !== ""
    ),
  );
  const busy = pendingAction !== null;
  const selectedNames = childrenList
    .filter((child) => draft.childIds.includes(child.id))
    .map((child) => child.name);
  const audienceSummary = selectedNames.length > 0
    ? selectedNames.join(" + ")
    : "Whole family";
  const repeatSummary = draft.recurrence
    ? draft.recurrence.interval > 1
      ? `Every ${draft.recurrence.interval} weeks`
      : "Every week"
    : "Does not repeat";
  const spansDays = draft.endsOn !== draft.startsOn;

  async function handleSave() {
    if (!draft.title.trim() || busy) return;
    setMutationError(null);
    setPendingAction("save");
    try {
      await onSave();
    } catch (cause) {
      reportCrash(cause, { surface: "native-planner", operation: "save-event" });
      setMutationError(
        `Homa couldn't confirm the save. Your event details are still here. Check your connection, then tap ${isEditing ? "Save changes" : "Add event"} again.`,
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (!onDelete || busy) return;
    setMutationError(null);
    setPendingAction("delete");
    try {
      await onDelete();
    } catch (cause) {
      reportCrash(cause, { surface: "native-planner", operation: "delete-event" });
      setMutationError(
        "Homa couldn't confirm whether the event was deleted. Close this window, then pull down on Planner to check.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function requestDelete() {
    if (!onDelete || busy) return;
    Alert.alert(
      "Delete this event?",
      "This removes the event from Homa. Any copy in your device calendar stays there.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete event", style: "destructive", onPress: () => void handleDelete() },
      ],
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={busy ? () => undefined : onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: space.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
          }}
        >
          <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
            {isEditing ? "Edit event" : "New event"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close event editor"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onClose}
            hitSlop={8}
          >
            <X size={22} color={colors.textSubtle} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
          <TextInput
            accessibilityLabel="Event title"
            accessibilityState={{ disabled: busy }}
            editable={!busy}
            value={draft.title}
            onChangeText={(title) => onChange({ ...draft, title })}
            placeholder="What's happening?"
            placeholderTextColor={colors.textSubtle}
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              padding: space.sm,
            }}
          />

          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
              Starts
            </Text>
            <DateStepper
              date={draft.startsOn}
              disabled={busy}
              onChange={(startsOn) =>
                onChange({
                  ...draft,
                  startsOn,
                  endsOn: draft.endsOn < startsOn ? startsOn : draft.endsOn,
                  recurrence: draft.recurrence
                    ? {
                        ...draft.recurrence,
                        weekdays:
                          draft.recurrence.weekdays.length === 1
                            ? [weekday(startsOn)]
                            : draft.recurrence.weekdays,
                        until:
                          draft.recurrence.until && draft.recurrence.until < startsOn
                            ? startsOn
                            : draft.recurrence.until,
                      }
                    : null,
                })
              }
            />
          </View>

          <View style={{ gap: space.xs }}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.hasTime, disabled: busy }}
              disabled={busy}
              onPress={() => onChange({ ...draft, hasTime: !draft.hasTime })}
              style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: radius.xs,
                  borderWidth: 1.5,
                  borderColor: draft.hasTime ? colors.brand : colors.border,
                  backgroundColor: draft.hasTime ? colors.brand : "transparent",
                }}
              />
              <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
                Add a time
              </Text>
            </Pressable>
            {draft.hasTime ? (
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <TimeStepper
                    time={draft.startTime}
                    disabled={busy}
                    onChange={(startTime) => onChange({ ...draft, startTime })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TimeStepper
                    time={draft.endTime}
                    disabled={busy}
                    onChange={(endTime) => onChange({ ...draft, endTime })}
                  />
                </View>
              </View>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: moreOpen, disabled: busy }}
            disabled={busy}
            onPress={() => setMoreOpen((open) => !open)}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              borderRadius: radius.sm,
              paddingHorizontal: space.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
                Who and repeat
              </Text>
              <Text
                numberOfLines={1}
                style={{ marginTop: 1, fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}
              >
                {audienceSummary} · {repeatSummary}
              </Text>
            </View>
            <ChevronDown
              size={19}
              color={colors.textMuted}
              style={{ transform: [{ rotate: moreOpen ? "180deg" : "0deg" }] }}
            />
          </Pressable>

          {moreOpen ? (
            <View style={{ gap: space.md }}>
              <View style={{ gap: space.xs }}>
                <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
                  Who is it for?
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: draft.childIds.length === 0, disabled: busy }}
                    disabled={busy}
                    onPress={() => onChange({ ...draft, childIds: [] })}
                    style={{
                      minHeight: 40,
                      justifyContent: "center",
                      paddingHorizontal: space.md,
                      borderRadius: radius.pill,
                      backgroundColor: draft.childIds.length === 0 ? colors.brand : colors.card,
                      borderWidth: 1,
                      borderColor: draft.childIds.length === 0 ? colors.brand : colors.borderSubtle,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fontFamilies.bodyMedium,
                        fontSize: fontSize.sm,
                        color: draft.childIds.length === 0 ? colors.onBrand : colors.textBody,
                      }}
                    >
                      Whole family
                    </Text>
                  </Pressable>
                  {childrenList.map((child) => {
                    const active = draft.childIds.includes(child.id);
                    return (
                      <Pressable
                        key={child.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active, disabled: busy }}
                        disabled={busy}
                        onPress={() =>
                          onChange({
                            ...draft,
                            childIds: active
                              ? draft.childIds.filter((childId) => childId !== child.id)
                              : [...draft.childIds, child.id],
                          })
                        }
                        style={{
                          minHeight: 40,
                          justifyContent: "center",
                          paddingHorizontal: space.md,
                          borderRadius: radius.pill,
                          backgroundColor: active ? colors.brand : colors.card,
                          borderWidth: 1,
                          borderColor: active ? colors.brand : colors.borderSubtle,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fontFamilies.bodyMedium,
                            fontSize: fontSize.sm,
                            color: active ? colors.onBrand : colors.textBody,
                          }}
                        >
                          {child.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: space.xs }}>
                <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
                  Repeat
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                  {[
                    { key: "once", label: "Does not repeat" },
                    {
                      key: "weekly",
                      label:
                        draft.recurrence && draft.recurrence.interval > 1
                          ? `Every ${draft.recurrence.interval} weeks`
                          : "Every week",
                    },
                  ].map((option) => {
                    const active = option.key === "weekly" ? draft.recurrence !== null : draft.recurrence === null;
                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active, disabled: busy }}
                        disabled={busy}
                        onPress={() =>
                          onChange({
                            ...draft,
                            recurrence:
                              option.key === "weekly"
                                ? {
                                    frequency: "weekly",
                                    interval: draft.recurrence?.interval ?? 1,
                                    weekdays: [weekday(draft.startsOn)],
                                    until: draft.recurrence?.until ?? null,
                                  }
                                : null,
                          })
                        }
                        style={{
                          minHeight: 40,
                          justifyContent: "center",
                          paddingHorizontal: space.md,
                          borderRadius: radius.pill,
                          backgroundColor: active ? colors.brand : colors.card,
                          borderWidth: 1,
                          borderColor: active ? colors.brand : colors.borderSubtle,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fontFamilies.bodyMedium,
                            fontSize: fontSize.sm,
                            color: active ? colors.onBrand : colors.textBody,
                          }}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {draft.recurrence ? (
                  draft.recurrence.until ? (
                    <View style={{ gap: space.xs }}>
                      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
                        Repeats until
                      </Text>
                      <DateStepper
                        date={draft.recurrence.until}
                        disabled={busy}
                        stepDays={7}
                        onChange={(until) =>
                          onChange({
                            ...draft,
                            recurrence: draft.recurrence ? { ...draft.recurrence, until } : null,
                          })
                        }
                      />
                      <Pressable
                        disabled={busy}
                        onPress={() =>
                          onChange({
                            ...draft,
                            recurrence: draft.recurrence ? { ...draft.recurrence, until: null } : null,
                          })
                        }
                        style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}
                      >
                        <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.brand }}>
                          Remove end date
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        onChange({
                          ...draft,
                          recurrence: draft.recurrence
                            ? { ...draft.recurrence, until: draft.startsOn }
                            : null,
                        })
                      }
                      style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}
                    >
                      <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.brand }}>
                        Add end date
                      </Text>
                    </Pressable>
                  )
                ) : null}
              </View>

              <View style={{ gap: space.xs }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: spansDays, disabled: busy }}
                  disabled={busy}
                  onPress={() =>
                    onChange({
                      ...draft,
                      endsOn: spansDays ? draft.startsOn : addDays(draft.startsOn, 1),
                    })
                  }
                  style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: space.sm }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: radius.xs,
                      borderWidth: 1.5,
                      borderColor: spansDays ? colors.brand : colors.border,
                      backgroundColor: spansDays ? colors.brand : "transparent",
                    }}
                  />
                  <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
                    Lasts more than one day
                  </Text>
                </Pressable>
                {spansDays ? (
                  <View style={{ gap: space.xs }}>
                    <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
                      Last day
                    </Text>
                    <DateStepper
                      date={draft.endsOn}
                      disabled={busy}
                      onChange={(endsOn) => onChange({ ...draft, endsOn: endsOn < draft.startsOn ? draft.startsOn : endsOn })}
                    />
                  </View>
                ) : null}
              </View>

              <View style={{ gap: space.xs }}>
                <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
                  Note
                </Text>
                <TextInput
                  accessibilityLabel="Note"
                  accessibilityState={{ disabled: busy }}
                  editable={!busy}
                  value={draft.note}
                  onChangeText={(note) => onChange({ ...draft, note })}
                  placeholder="Optional"
                  placeholderTextColor={colors.textSubtle}
                  multiline
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.sm,
                    color: colors.textBody,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    padding: space.sm,
                    minHeight: 72,
                    textAlignVertical: "top",
                  }}
                />
              </View>
            </View>
          ) : null}

          {mutationError ? <InlineError message={mutationError} /> : null}

          <Button
            label={pendingAction === "save" ? "Saving…" : isEditing ? "Save changes" : "Add event"}
            onPress={() => void handleSave()}
            disabled={busy || !draft.title.trim()}
            busy={pendingAction === "save"}
          />
          {isEditing && onDelete ? (
            <Button
              label={pendingAction === "delete" ? "Deleting…" : "Delete event"}
              variant="ghost"
              onPress={requestDelete}
              disabled={busy}
              busy={pendingAction === "delete"}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
