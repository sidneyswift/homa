import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import { hourLabel } from "./task-view";

/**
 * Schedule fields shared by the built-in schedule-only editor and the
 * full custom-task form, ported from apps/web/app/app/tasks/task-form.tsx.
 * A native <select> has no RN equivalent, so the hour field becomes a
 * scrollable chip row, the same widget shape web already uses for days.
 */

const DAYS: readonly { value: number; short: string }[] = [
  { value: 0, short: "S" },
  { value: 1, short: "M" },
  { value: 2, short: "T" },
  { value: 3, short: "W" },
  { value: 4, short: "T" },
  { value: 5, short: "F" },
  { value: 6, short: "S" },
];

export function WeekdayChips({
  selected,
  onChange,
}: {
  selected: ReadonlySet<number>;
  onChange: (next: Set<number>) => void;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
        Which days?
      </Text>
      <View style={{ flexDirection: "row", gap: space.xs }}>
        {DAYS.map((day, index) => {
          const active = selected.has(day.value);
          return (
            <Pressable
              key={`${day.value}-${index}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              onPress={() => {
                const next = new Set(selected);
                if (active) next.delete(day.value);
                else next.add(day.value);
                onChange(next);
              }}
              style={{
                height: 36,
                width: 36,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border,
                backgroundColor: active ? colors.brandSoft : colors.card,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodyBold,
                  fontSize: fontSize.xs,
                  color: active ? colors.brandHover : colors.textMuted,
                }}
              >
                {day.short}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function HourChips({ hour, onChange }: { hour: number; onChange: (hour: number) => void }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
        What time?
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
        {HOURS.map((option) => {
          const active = option === hour;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: space.xs,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.borderSubtle,
                backgroundColor: active ? colors.brandSoft : colors.card,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodyBold,
                  fontSize: fontSize.xs,
                  color: active ? colors.brandHover : colors.textMuted,
                }}
              >
                {hourLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export type DeliveryPref = "text" | "email" | "none";

/** The "Text me" label tells the parent her own situation instead of a
 * conditional rule she has to work out herself. */
function deliveryOptions(textingLinked: boolean): { value: DeliveryPref; label: string }[] {
  return [
    {
      value: "text",
      label: textingLinked ? "Text me." : "Text me. Until texting is set up, it emails you instead.",
    },
    { value: "email", label: "Email me." },
    { value: "none", label: "Just save it to this page." },
  ];
}

export function DeliveryChoice({
  value,
  onChange,
  textingLinked,
}: {
  value: DeliveryPref;
  onChange: (value: DeliveryPref) => void;
  textingLinked: boolean;
}) {
  const router = useRouter();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
        How should it reach you?
      </Text>
      <View style={{ gap: space.xs }}>
        {deliveryOptions(textingLinked).map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onChange(option.value)}
              style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
            >
              <View
                style={{
                  height: 18,
                  width: 18,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: active ? colors.brand : colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {active ? (
                  <View style={{ height: 10, width: 10, borderRadius: radius.pill, backgroundColor: colors.brand }} />
                ) : null}
              </View>
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody, flexShrink: 1 }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        {!textingLinked ? (
          <Pressable onPress={() => router.push("/settings")}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.brand }}>
              Set up texting in Settings
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
