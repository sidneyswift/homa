import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import { reportCrash } from "../../lib/crash-reporting";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import { addDays, formatMonthDay, formatWeekdayLong, type DateOnly } from "./date-utils";
import type { PlanActivityView } from "./planner-model";

/** Picks a real day for an unscheduled plan activity, upserting
 * plan_activity_schedule directly (an authenticated family member's own
 * RLS-scoped write, same as schedulePlanActivityCaller uses on web). */
export function ScheduleActivitySheet({
  activity,
  initialDate,
  onSchedule,
  onClose,
}: {
  activity: PlanActivityView | null;
  initialDate: DateOnly;
  onSchedule: (date: DateOnly) => Promise<void>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const visible = activity !== null;

  async function handleSchedule() {
    if (saving) return;
    setMutationError(null);
    setSaving(true);
    try {
      await onSchedule(date);
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-planner",
        operation: "schedule-activity",
      });
      setMutationError(
        "Your choice is still here. Homa couldn't confirm the schedule. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={saving ? () => undefined : onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(51,42,33,0.42)" }}>
        <SafeAreaView
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: space.lg,
            gap: space.md,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
                Put this on a day
              </Text>
              {activity ? (
                <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
                  {activity.text}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close activity scheduler"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={onClose}
              hitSlop={8}
            >
              <X size={22} color={colors.textSubtle} />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.surfaceSunken,
              borderRadius: radius.sm,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous day"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => setDate((current) => addDays(current, -1))}
              hitSlop={8}
            >
              <ChevronLeft size={22} color={colors.textBody} />
            </Pressable>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.base, color: colors.textBody }}>
                {formatWeekdayLong(date)}
              </Text>
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
                {formatMonthDay(date)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next day"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => setDate((current) => addDays(current, 1))}
              hitSlop={8}
            >
              <ChevronRight size={22} color={colors.textBody} />
            </Pressable>
          </View>

          {mutationError ? <InlineError message={mutationError} /> : null}
          <Button
            label={saving ? "Scheduling…" : "Put here"}
            onPress={() => void handleSchedule()}
            busy={saving}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
