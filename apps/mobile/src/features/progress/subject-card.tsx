import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "../../components/design/icon";
import type { ChildProgressView, ProgressSubjectView } from "../../lib/child-progress";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, shadows, space } from "../../theme/tokens";
import { subjectFreshness } from "./map-model";
import { TopicRow } from "./topic-row";
import {
  progressSubjectHeadline,
  progressSubjectSummary,
  progressSubjectTakeaway,
} from "./view-copy";

/**
 * One subject card, ported from apps/web/components/progress/
 * progress-map.tsx's tile + progress-detail-panel.tsx's domain/topic
 * body, collapsed into a single expandable card (no separate side
 * panel route on mobile v1). Tapping the header expands domains and
 * their topics inline.
 */
export function SubjectCard({
  subject,
  conflicts,
  timeZone,
}: {
  subject: ProgressSubjectView;
  conflicts: ChildProgressView["conflicts"];
  timeZone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const freshness = subjectFreshness(subject, timeZone, new Date());
  const summary = progressSubjectSummary(subject, timeZone, conflicts);
  const takeaway = progressSubjectTakeaway(subject, conflicts);
  const needsConfirm = subject.state === "conflict";
  const statusLabel =
    needsConfirm || freshness?.kind === "quiet"
      ? progressSubjectHeadline(subject.state)
      : null;
  const accessibilitySummary =
    [
      ...new Set([
        takeaway?.statement,
        statusLabel,
        takeaway?.stateLabel,
        summary?.accessibilityLabel,
      ]),
    ]
      .filter(Boolean)
      .join(". ") || "No evidence yet";

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        ...shadows.sm,
      }}
    >
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${subject.displayName}. ${accessibilitySummary}`}
        accessibilityHint={
          expanded
            ? "Collapses the subject details"
            : "Expands the subject details"
        }
        style={{ padding: space.md, gap: space.xs }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: space.sm,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              minWidth: 150,
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.base,
              color: colors.textStrong,
            }}
          >
            {subject.displayName}
          </Text>
          {statusLabel ? (
            <View
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: colors.goldSoft,
              }}
            >
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: palette.goldInk }}>
                {statusLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {takeaway ? (
          <View style={{ gap: 2 }}>
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: colors.textStrong,
              }}
            >
              {takeaway.statement}
            </Text>
            {!needsConfirm ? (
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.sm,
                  color: colors.textBody,
                }}
              >
                {takeaway.stateLabel}
              </Text>
            ) : null}
          </View>
        ) : null}

        {summary ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            {freshness ? (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: freshness.dotColor,
                  marginTop: 6,
                }}
              />
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  columnGap: space.sm,
                  rowGap: 2,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.bodySemibold,
                    fontSize: fontSize.xs,
                    color: colors.textBody,
                  }}
                >
                  {summary.sourceLabel}
                </Text>
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.xs,
                    color: colors.textMuted,
                  }}
                >
                  {summary.dateLabel}
                </Text>
              </View>
              {summary.derivationLabel ? (
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.xs,
                    color: colors.textMuted,
                  }}
                >
                  {summary.derivationLabel}
                </Text>
              ) : null}
              {summary.note ? (
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.xs,
                    color: colors.textMuted,
                  }}
                >
                  {summary.note}
                </Text>
              ) : null}
            </View>
          </View>
        ) : freshness ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: freshness.dotColor }}
            />
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
              {freshness.label}
            </Text>
          </View>
        ) : null}

        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            alignSelf: "flex-start",
            minHeight: 44,
            paddingHorizontal: space.sm,
            paddingVertical: space.xs,
            flexDirection: "row",
            alignItems: "center",
            gap: space.xs,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceSunken,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.xs,
              color: colors.textBody,
            }}
          >
            {expanded ? "Hide details" : "Show details"}
          </Text>
          <Icon
            name="collapse"
            size={20}
            color={colors.textBody}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
          {subject.domains.map((domain) => (
            <View key={domain.domainId} style={{ marginTop: space.sm }}>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.sm,
                  color: colors.textBody,
                }}
              >
                {domain.displayName}
              </Text>
              {domain.topics.map((topic) => (
                <TopicRow
                  key={topic.itemId}
                  topic={topic}
                  timeZone={timeZone}
                  conflict={conflicts.find((entry) => entry.itemId === topic.itemId) ?? null}
                />
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
