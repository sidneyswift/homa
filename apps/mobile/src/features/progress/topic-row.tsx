import { View, Text } from "react-native";

import type { OpenProgressConflictView, ProgressTopicView } from "../../lib/child-progress";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import {
  formatProgressDate,
  progressAnswerLabel,
  progressConflictAnswerLine,
  progressEvidenceDerivationLabel,
  progressTopicStateLabel,
} from "./view-copy";

const STATE_CHIP_TONES: Record<ProgressTopicView["state"], { background: string; color: string }> = {
  observed_today: { background: colors.sageSoft, color: colors.success },
  older: { background: colors.surfaceSunken, color: colors.textMuted },
  ask_next: { background: colors.surfaceSunken, color: colors.textMuted },
  conflict: { background: colors.goldSoft, color: palette.goldInk },
};

function StateChip({ state }: { state: ProgressTopicView["state"] }) {
  const tone = STATE_CHIP_TONES[state];
  return (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: tone.background,
      }}
    >
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: tone.color }}>
        {progressTopicStateLabel(state)}
      </Text>
    </View>
  );
}

/**
 * One topic row, ported from apps/web/components/progress/
 * progress-topic-row.tsx. `detail` (e.g. "Shared by Mom.") arrives
 * already formatted in the projection, so it's rendered as-is rather
 * than reconstructed here.
 *
 * Conflict rows show both saved answers read-only: web lets a parent
 * tap one to confirm it via POST /api/progress/conflict, which needs
 * an authenticated write route mobile doesn't have yet. Reading both
 * answers with nothing silently dropped is the honest interim shape;
 * the confirm action is a tracked gap, not a hidden one.
 */
export function TopicRow({
  topic,
  conflict,
  timeZone,
}: {
  topic: ProgressTopicView;
  conflict: OpenProgressConflictView | null;
  timeZone: string;
}) {
  const conflictLines =
    topic.state === "conflict" && conflict
      ? conflict.adultAnswers.map((entry) =>
          progressConflictAnswerLine(entry, timeZone),
        )
      : [];
  const accessibilityLabel = [
    topic.statement,
    progressTopicStateLabel(topic.state),
    topic.answer ? progressAnswerLabel(topic.answer) : null,
    ...conflictLines,
    topic.state !== "conflict" ? topic.detail : null,
    topic.state !== "conflict" && topic.source
      ? progressEvidenceDerivationLabel(
          topic.source.derivation,
          topic.source.adultDisplayName,
        )
      : null,
    topic.state !== "conflict" && topic.observedAt
      ? formatProgressDate(topic.observedAt, timeZone)
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{
        paddingVertical: space.sm,
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
        <Text
          style={{ flex: 1, fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}
        >
          {topic.statement}
        </Text>
        {topic.state === "conflict" ? null : <StateChip state={topic.state} />}
      </View>

      {topic.state === "conflict" && conflict ? (
        <View style={{ gap: 4 }}>
          {conflict.adultAnswers.map((entry) => (
            <Text
              key={entry.evidenceId}
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}
            >
              {progressConflictAnswerLine(entry, timeZone)}
            </Text>
          ))}
        </View>
      ) : (
        <>
          {topic.answer ? (
            <Text
              style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}
            >
              {progressAnswerLabel(topic.answer)}
            </Text>
          ) : null}
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
            {topic.detail}
            {topic.source
              ? ` ${progressEvidenceDerivationLabel(
                  topic.source.derivation,
                  topic.source.adultDisplayName,
                )}.`
              : ""}
            {topic.observedAt ? ` ${formatProgressDate(topic.observedAt, timeZone)}.` : ""}
          </Text>
        </>
      )}
    </View>
  );
}
