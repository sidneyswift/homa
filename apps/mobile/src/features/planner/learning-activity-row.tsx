import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { Icon } from "../../components/design/icon";
import { InlineError } from "../../components/ui/inline-error";
import { reportCrash } from "../../lib/crash-reporting";
import type { ChildRecord } from "../../lib/family";
import type { PlannerLearningActivityRecord } from "../../lib/planner-learning-activities";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

function audienceLabel(
  activity: PlannerLearningActivityRecord,
  kids: readonly ChildRecord[],
): string {
  if (activity.childIds.length === 0) return "Whole family";
  return activity.childIds
    .map((childId) => kids.find((kid) => kid.id === childId)?.name ?? "Child")
    .join(" + ");
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

export function LearningActivityRow({
  activity,
  kids,
  onToggle,
}: {
  activity: PlannerLearningActivityRecord;
  kids: readonly ChildRecord[];
  onToggle: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const completed = activity.status === "completed";

  async function runToggle() {
    if (pending) return;
    setPending(true);
    setMutationError(null);
    try {
      await onToggle();
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-planner",
        operation: "toggle-learning-activity",
      });
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "Homa couldn't confirm that check. Pull down to refresh.",
      );
    } finally {
      setPending(false);
    }
  }

  function handleToggle() {
    if (pending) return;
    if (completed && activity.hoursEntryIds.length > 0) {
      Alert.alert(
        "Mark not finished?",
        "The time linked to this activity will also be removed from Hours.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Mark not finished", style: "destructive", onPress: () => void runToggle() },
        ],
      );
      return;
    }
    void runToggle();
  }

  return (
    <View style={{ paddingVertical: space.xs }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${activity.title}. ${audienceLabel(activity, kids)}, ${activity.subject}`}
        accessibilityState={{
          checked: completed,
          disabled: pending,
          busy: pending,
        }}
        disabled={pending}
        onPress={handleToggle}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: space.sm,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.xs,
            borderWidth: 1.5,
            borderColor: completed ? colors.action : colors.border,
            backgroundColor: completed ? colors.action : "transparent",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          {completed ? <Icon name="check" size={16} color={colors.onBrand} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: completed ? colors.textMuted : colors.textBody,
              textDecorationLine: completed ? "line-through" : "none",
            }}
          >
            {activity.title}
          </Text>
          <Text
            style={{
              fontFamily: fontFamilies.bodyMedium,
              fontSize: fontSize.xs,
              color: colors.textMuted,
            }}
          >
            {audienceLabel(activity, kids)} · {activity.subject}
            {completed && activity.durationMinutes
              ? ` · ${durationLabel(activity.durationMinutes)} reported`
              : ""}
          </Text>
        </View>
      </Pressable>
      {mutationError ? (
        <InlineError message={mutationError} style={{ marginTop: space.xs }} />
      ) : null}
    </View>
  );
}
