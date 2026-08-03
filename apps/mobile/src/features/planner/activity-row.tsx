import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { InlineError } from "../../components/ui/inline-error";
import { Icon } from "../../components/design/icon";
import { reportCrash } from "../../lib/crash-reporting";
import { PlanActivityCheckConflictError } from "../../lib/plan-check-mutation";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import type { PlanActivityView } from "./planner-model";

/**
 * One plan activity: a checkbox plus its text, ported from web's
 * ActivityCard/usePlanChecks (apps/web/app/app/planner/day-grid.tsx).
 * Checking here calls the stale-safe atomic plan operation. A normal
 * revision conflict is a refresh state, not a crash.
 */
export function ActivityRow({
  activity,
  onToggle,
}: {
  activity: PlanActivityView;
  onToggle: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [pendingDone, setPendingDone] = useState<boolean | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const checked = pendingDone ?? activity.done;

  async function handleToggle() {
    if (pending) return;
    setMutationError(null);
    setPendingDone(!activity.done);
    setPending(true);
    try {
      await onToggle();
    } catch (cause) {
      if (cause instanceof PlanActivityCheckConflictError) {
        setMutationError(
          "This plan changed since you opened it. Pull down to refresh, then check the activity before trying again.",
        );
        return;
      }
      reportCrash(cause, { surface: "native-planner", operation: "toggle-activity" });
      setMutationError(
        "Homa couldn't confirm that check. Pull down to refresh before trying again.",
      );
    } finally {
      setPendingDone(null);
      setPending(false);
    }
  }

  return (
    <View style={{ paddingVertical: space.xs }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${activity.text}. ${activity.childName}, ${activity.subjectName}`}
        accessibilityState={{
          checked,
          disabled: pending,
          busy: pending,
        }}
        disabled={pending}
        onPress={() => void handleToggle()}
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
            borderColor: checked ? colors.action : colors.border,
            backgroundColor: checked ? colors.action : "transparent",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          {checked ? <Icon name="check" size={16} color={colors.onBrand} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: checked ? colors.textMuted : colors.textBody,
              textDecorationLine: checked ? "line-through" : "none",
            }}
          >
            {activity.text}
          </Text>
          <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textMuted }}>
            {activity.childName} · {activity.subjectName}
          </Text>
        </View>
      </Pressable>
      {mutationError ? (
        <InlineError message={mutationError} style={{ marginTop: space.xs }} />
      ) : null}
      {activity.sources.length > 0 ? (
        <View style={{ marginLeft: 28, marginTop: 3, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.xs }}>
          <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textMuted }}>
            From{" "}
          </Text>
          {activity.sources.map((source, index) => (
            <Pressable
              key={source.id}
              accessibilityRole="link"
              accessibilityLabel={`Open source ${source.title}${source.sourceLocator ? `, ${source.sourceLocator}` : ""}`}
              accessibilityHint="Opens the Family Library source"
              onPress={() => void Linking.openURL(source.libraryUrl)}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textStrong, textDecorationLine: "underline" }}>
                {index > 0 ? "Also " : ""}
                {source.title}
                {source.sourceLocator ? ` · ${source.sourceLocator}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
