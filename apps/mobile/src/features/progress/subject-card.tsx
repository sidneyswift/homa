import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { ChildProgressView, ProgressSubjectView } from "../../lib/child-progress";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";
import { subjectBadge, subjectFreshness } from "./map-model";
import { TopicRow } from "./topic-row";
import { progressSubjectHeadline, progressSubjectSummary } from "./view-copy";

/**
 * One subject card, ported from apps/web/components/progress/
 * progress-map.tsx's tile + progress-detail-panel.tsx's domain/topic
 * body, collapsed into a single expandable card (no separate side
 * panel route on mobile v1). Tapping the header expands domains and
 * their topics inline.
 */
export function SubjectCard({
  subject,
  scores,
  conflicts,
  childName,
  timeZone,
}: {
  subject: ProgressSubjectView;
  scores: ChildProgressView["scores"];
  conflicts: ChildProgressView["conflicts"];
  childName: string;
  timeZone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const badge = subjectBadge(scores, subject.subjectId, childName);
  const freshness = subjectFreshness(subject, timeZone, new Date());
  const summary = progressSubjectSummary(subject, timeZone);
  const needsConfirm = subject.state === "conflict";

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
        style={{ padding: space.md, gap: space.xs }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Text
            style={{
              flex: 1,
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.base,
              color: colors.textStrong,
            }}
          >
            {subject.displayName}
          </Text>
          {needsConfirm ? (
            <View
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: colors.goldSoft,
              }}
            >
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.gold }}>
                {progressSubjectHeadline("conflict")}
              </Text>
            </View>
          ) : null}
          {expanded ? (
            <ChevronUp size={18} color={colors.textSubtle} />
          ) : (
            <ChevronDown size={18} color={colors.textSubtle} />
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
          {freshness ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: freshness.dotColor }}
              />
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
                {freshness.label}
              </Text>
            </View>
          ) : null}
          {badge ? (
            <View
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 2,
                borderRadius: radius.pill,
                backgroundColor: badge.background,
              }}
            >
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: badge.color }}>
                {badge.label}
              </Text>
            </View>
          ) : null}
        </View>

        {summary ? (
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
            {summary}
          </Text>
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
          {subject.domains.map((domain) => (
            <View key={domain.domainId} style={{ marginTop: space.sm }}>
              <Text
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
