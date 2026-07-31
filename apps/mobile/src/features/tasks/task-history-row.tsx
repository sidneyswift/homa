import { useRouter } from "expo-router";
import { Bell, FlaskConical, Moon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { ResearchBriefFeedbackSignal, TaskRunView } from "../../lib/tasks";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";
import { isResearchBriefFeedbackEligible, showsAskHoma, statusNote, timeLabel } from "./task-view";

/**
 * One run's history card, ported from apps/web/app/app/tasks/
 * task-history.tsx. Fleet research rows never reach a family's own
 * history (RLS hides family_id-null rows), so everything here belongs
 * to this family.
 */

function runIcon(kind: TaskRunView["kind"]) {
  switch (kind) {
    case "morning_brief":
    case "fleet_research":
      return <FlaskConical size={16} color={colors.brand} />;
    case "journal_prompt":
      return <Moon size={16} color={colors.brand} />;
    case "custom":
    case "agent_job":
      return <Bell size={16} color={colors.brand} />;
    default: {
      const exhaustive: never = kind;
      void exhaustive;
      return <Bell size={16} color={colors.brand} />;
    }
  }
}

function FeedbackButton({
  label,
  active,
  pending,
  onPress,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: pending }}
      disabled={pending}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? colors.brandHover : colors.borderSubtle,
        backgroundColor: active ? colors.brandSoft : colors.card,
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: fontSize.xs,
          color: active ? colors.brandHover : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BriefFeedbackControls({
  run,
  onFeedback,
}: {
  run: TaskRunView;
  onFeedback: (signal: ResearchBriefFeedbackSignal) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePress(signal: ResearchBriefFeedbackSignal) {
    setPending(true);
    setError(null);
    const ok = await onFeedback(signal);
    if (!ok) setError("That didn't save. Try again.");
    setPending(false);
  }

  return (
    <View style={{ marginTop: space.sm, gap: space.xs }}>
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
        Was this helpful?
      </Text>
      <View style={{ flexDirection: "row", gap: space.xs }}>
        <FeedbackButton
          label="Helpful"
          active={run.feedbackSignal === "helpful"}
          pending={pending}
          onPress={() => void handlePress("helpful")}
        />
        <FeedbackButton
          label="Not for us"
          active={run.feedbackSignal === "not_for_us"}
          pending={pending}
          onPress={() => void handlePress("not_for_us")}
        />
      </View>
      {error ? (
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function TaskHistoryRow({
  run,
  timeZone,
  onFeedback,
}: {
  run: TaskRunView;
  timeZone: string;
  onFeedback: (signal: ResearchBriefFeedbackSignal) => Promise<boolean>;
}) {
  const router = useRouter();
  const note = statusNote(run);
  const askable = showsAskHoma(run);
  const feedbackable = isResearchBriefFeedbackEligible(run);

  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.card,
        padding: space.md,
        ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, flex: 1 }}>
          {runIcon(run.kind)}
          <Text
            numberOfLines={1}
            style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong, flexShrink: 1 }}
          >
            {run.title}
          </Text>
        </View>
        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, color: colors.textSubtle }}>
          {timeLabel(run.startedAt, timeZone)}
        </Text>
      </View>
      {run.summary ? (
        <Text style={{ marginTop: space.xs, fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody, lineHeight: 20 }}>
          {run.summary}
        </Text>
      ) : null}
      {note || askable ? (
        <View style={{ marginTop: space.xs, flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {note ? (
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textSubtle }}>
              {note}
            </Text>
          ) : null}
          {askable ? (
            <Pressable onPress={() => router.push("/chat")}>
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.brand }}>
                Ask Homa about this
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {feedbackable ? <BriefFeedbackControls run={run} onFeedback={onFeedback} /> : null}
    </View>
  );
}
