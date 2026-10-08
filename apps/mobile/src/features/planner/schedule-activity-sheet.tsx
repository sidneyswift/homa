import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccessibleModal } from "../../components/ui/accessible-modal";
import { Button } from "../../components/ui/button";
import { Icon } from "../../components/design/icon";
import { IconButton } from "../../components/ui/icon-button";
import { InlineError } from "../../components/ui/inline-error";
import { reportCrash } from "../../lib/crash-reporting";
import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";
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
  const headingRef = useRef<View>(null);
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
    <AccessibleModal
      visible={visible}
      title="Put this on a day"
      initialFocusRef={headingRef}
      transparent
      onRequestClose={saving ? () => undefined : onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(51,42,33,0.42)" }}>
        <SafeAreaView
          style={{
            maxHeight: "90%",
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
          }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: space.lg, gap: space.md }}
          >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View ref={headingRef} accessible accessibilityRole="header" accessibilityLabel="Put this on a day" style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
                Put this on a day
              </Text>
              {activity ? (
                <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
                  {activity.text}
                </Text>
              ) : null}
            </View>
            <IconButton
              label="Close activity scheduler"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={onClose}
            >
              <Icon name="close" size={24} color={colors.textSubtle} />
            </IconButton>
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
            <IconButton
              label="Previous day"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => setDate((current) => addDays(current, -1))}
            >
              <Icon name="back" size={24} color={colors.textBody} />
            </IconButton>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.base, color: colors.textBody }}>
                {formatWeekdayLong(date)}
              </Text>
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
                {formatMonthDay(date)}
              </Text>
            </View>
            <IconButton
              label="Next day"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={() => setDate((current) => addDays(current, 1))}
            >
              <Icon name="next" size={24} color={colors.textBody} />
            </IconButton>
          </View>

          {mutationError ? <InlineError message={mutationError} /> : null}
          <Button
            label={saving ? "Scheduling…" : "Put here"}
            onPress={() => void handleSchedule()}
            busy={saving}
          />
          </ScrollView>
        </SafeAreaView>
      </View>
    </AccessibleModal>
  );
}
