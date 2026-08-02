import { Bell, ChevronRight, FlaskConical, Moon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { TaskRowView } from "../../lib/tasks";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";
import { BUILT_IN_COPY, hourLabel, nextRunLabel, weekdaysLabel } from "./task-view";

/**
 * The scheduled-task card, ported from apps/web/app/app/tasks/
 * tasks-view.tsx's TaskCard/DarkKindCard/PauseToggle. Tapping the card
 * opens the edit sheet; the switch acts on its own without opening it.
 */

function taskIcon(kind: TaskRowView["kind"], color: string) {
  switch (kind) {
    case "morning_brief":
      return <FlaskConical size={18} color={color} />;
    case "journal_prompt":
      return <Moon size={18} color={color} />;
    case "custom":
      return <Bell size={18} color={color} />;
    default: {
      const exhaustive: never = kind;
      void exhaustive;
      return <Bell size={18} color={color} />;
    }
  }
}

function PauseToggle({
  label,
  on,
  pending,
  onToggle,
}: {
  label: string;
  on: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: pending }}
      accessibilityLabel={`${label} task`}
      disabled={pending}
      onPress={onToggle}
      style={{ minWidth: 52, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: pending ? 0.6 : 1 }}
    >
      <View
        style={{
          height: 26,
          width: 46,
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderColor: on ? colors.brandHover : colors.textMuted,
          backgroundColor: on ? colors.brandHover : colors.surfaceSunken,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 3,
            left: on ? 23 : 3,
            height: 20,
            width: 20,
            borderRadius: radius.pill,
            backgroundColor: on ? colors.card : colors.textMuted,
            ...shadows.sm,
          }}
        />
      </View>
    </Pressable>
  );
}

export function TaskCard({
  task,
  timeZone,
  now,
  pausePending,
  onPress,
  onTogglePaused,
}: {
  task: TaskRowView;
  timeZone: string;
  now: Date;
  pausePending: boolean;
  onPress: () => void;
  onTogglePaused: () => void;
}) {
  const on = !task.paused;
  const copy = task.kind === "custom" ? { label: task.label ?? "Your task", description: task.prompt ?? "" } : BUILT_IN_COPY[task.kind];
  const upcoming = on && task.nextRunAt !== null && new Date(task.nextRunAt).getTime() > now.getTime();
  const next = upcoming && task.nextRunAt !== null ? nextRunLabel(task.nextRunAt, timeZone) : null;

  const deliveryLabel =
    task.deliveryPref === "text" ? "by text" : task.deliveryPref === "email" ? "by email" : "saved to this page";

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: space.md,
        gap: space.sm,
        ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm, flex: 1 }}>
          <View
            style={{
              height: 36,
              width: 36,
              borderRadius: radius.pill,
              backgroundColor: on ? colors.brandSoft : colors.surfaceSunken,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {taskIcon(task.kind, on ? colors.brand : colors.textSubtle)}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.base, color: colors.textStrong }}>
              {copy.label}
            </Text>
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}
            >
              {copy.description}
            </Text>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              {weekdaysLabel(task.weekdays)} {"·"} {hourLabel(task.localHour)} {"·"} {deliveryLabel}
            </Text>
          </View>
        </View>
        <PauseToggle label={copy.label} on={on} pending={pausePending} onToggle={onTogglePaused} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {next ? (
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.brandSoft }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, color: colors.textStrong }}>
              Next {"·"} {next}
            </Text>
          </View>
        ) : on && task.nextRunAt !== null ? (
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.brandSoft }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, color: colors.textStrong }}>Next {"·"} soon</Text>
          </View>
        ) : !on ? (
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, color: colors.textMuted }}>Off</Text>
          </View>
        ) : (
          <View />
        )}
        <ChevronRight size={16} color={colors.textSubtle} />
      </View>
    </Pressable>
  );
}

export function BuiltInPlaceholderCard({ kind, note }: { kind: "morning_brief" | "journal_prompt"; note: string }) {
  const copy = BUILT_IN_COPY[kind];
  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: colors.borderSubtle,
        backgroundColor: colors.card,
        padding: space.md,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
      }}
    >
      <View
        style={{
          height: 36,
          width: 36,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceSunken,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {taskIcon(kind, colors.textSubtle)}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.base, color: colors.textStrong }}>
          {copy.label}
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
          {copy.description}
        </Text>
        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
          {note}
        </Text>
      </View>
    </View>
  );
}
