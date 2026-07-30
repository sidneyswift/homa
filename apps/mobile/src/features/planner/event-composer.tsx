import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import type { ChildRecord } from "../../lib/family";
import type { FamilyEventInput, FamilyEventRecord } from "../../lib/family-events";
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

function DateStepper({ date, onChange }: { date: DateOnly; onChange: (next: DateOnly) => void }) {
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
      <Pressable onPress={() => onChange(addDays(date, -1))} hitSlop={8}>
        <ChevronLeft size={20} color={colors.textBody} />
      </Pressable>
      <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
        {formatWeekdayShort(date)}, {formatMonthDay(date)}
      </Text>
      <Pressable onPress={() => onChange(addDays(date, 1))} hitSlop={8}>
        <ChevronRight size={20} color={colors.textBody} />
      </Pressable>
    </View>
  );
}

function TimeStepper({ time, onChange }: { time: string; onChange: (next: string) => void }) {
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
      <Pressable onPress={() => onChange(stepTime(time, -1))} hitSlop={8}>
        <ChevronLeft size={20} color={colors.textBody} />
      </Pressable>
      <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
        {formatTimeLabel(time)}
      </Text>
      <Pressable onPress={() => onChange(stepTime(time, 1))} hitSlop={8}>
        <ChevronRight size={20} color={colors.textBody} />
      </Pressable>
    </View>
  );
}

export interface EventComposerDraft {
  title: string;
  childId: string | null;
  startsOn: DateOnly;
  endsOn: DateOnly;
  hasTime: boolean;
  startTime: string;
  endTime: string;
  note: string;
}

export function draftFromEvent(event: FamilyEventRecord): EventComposerDraft {
  return {
    title: event.title,
    childId: event.child_id,
    startsOn: event.starts_on,
    endsOn: event.ends_on,
    hasTime: Boolean(event.start_time),
    startTime: event.start_time ?? "09:00",
    endTime: event.end_time ?? "10:00",
    note: event.note ?? "",
  };
}

export function blankDraft(date: DateOnly): EventComposerDraft {
  return {
    title: "",
    childId: null,
    startsOn: date,
    endsOn: date,
    hasTime: false,
    startTime: "09:00",
    endTime: "10:00",
    note: "",
  };
}

export function draftToInput(draft: EventComposerDraft): FamilyEventInput {
  return {
    childId: draft.childId,
    title: draft.title,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn,
    startTime: draft.hasTime ? draft.startTime : null,
    endTime: draft.hasTime ? draft.endTime : null,
    note: draft.note || null,
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
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft.title.trim()) return;
    setSaving(true);
    await onSave();
    setSaving(false);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
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
            {isEditing ? "Edit plan" : "New plan"}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.textSubtle} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
          <TextInput
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
              For
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
              {[{ id: null, name: "Everyone" }, ...childrenList].map((option) => {
                const active = option.id === draft.childId;
                return (
                  <Pressable
                    key={option.id ?? "everyone"}
                    onPress={() => onChange({ ...draft, childId: option.id })}
                    style={{
                      paddingHorizontal: space.md,
                      paddingVertical: space.xs,
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
                      {option.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
              Starts
            </Text>
            <DateStepper
              date={draft.startsOn}
              onChange={(startsOn) =>
                onChange({
                  ...draft,
                  startsOn,
                  endsOn: draft.endsOn < startsOn ? startsOn : draft.endsOn,
                })
              }
            />
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody, marginTop: space.xs }}>
              Ends
            </Text>
            <DateStepper
              date={draft.endsOn}
              onChange={(endsOn) => onChange({ ...draft, endsOn: endsOn < draft.startsOn ? draft.startsOn : endsOn })}
            />
          </View>

          <View style={{ gap: space.xs }}>
            <Pressable
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
                Set a time (first day only)
              </Text>
            </Pressable>
            {draft.hasTime ? (
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <TimeStepper time={draft.startTime} onChange={(startTime) => onChange({ ...draft, startTime })} />
                </View>
                <View style={{ flex: 1 }}>
                  <TimeStepper time={draft.endTime} onChange={(endTime) => onChange({ ...draft, endTime })} />
                </View>
              </View>
            ) : null}
          </View>

          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
              Note
            </Text>
            <TextInput
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

          <Button
            label={saving ? "Saving…" : isEditing ? "Save changes" : "Add to plan"}
            onPress={() => void handleSave()}
            disabled={saving || !draft.title.trim()}
          />
          {isEditing && onDelete ? (
            <Button label="Delete" variant="ghost" onPress={onDelete} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
