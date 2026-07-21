import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { env } from "../../lib/env";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import type { ProgressTileModel } from "./map-model";
import type {
  OpenProgressConflictView,
  ProgressDomainView,
  ProgressSubjectView,
  ProgressTopicView,
} from "./types";
import {
  formatProgressDate,
  progressAnswerLabel,
  progressSourceLabel,
  progressSubjectSummary,
  progressTopicStateLabel,
} from "./view-copy";

/**
 * One subject's domains and topics in a bottom sheet, ported from
 * apps/web/components/progress/progress-detail-panel.tsx (with
 * progress-domain.tsx and progress-topic-row.tsx folded in). Read-only
 * by design: conflict answers render as the web twin's plain boxes (its
 * actions-omitted variant), and the deeper-check door opens the web
 * flow, which owns the questions, the rescore, and the rewrite. Nothing
 * on this sheet writes.
 */

/** Topic chip tones (web TOPIC_STATE_TONES): gold is reserved for
 * "waiting on you" (conflict), so Homa's own follow-ups stay neutral
 * stone. pop-navy and sage-700 have no mobile tokens; sky500 and
 * sage600 are their nearest hand-copied tones. */
const TOPIC_STATE_TONES: Record<
  ProgressTopicView["state"],
  { background: string; color: string }
> = {
  observed_today: { background: colors.sageSoft, color: palette.sage600 },
  older: { background: palette.sky100, color: palette.sky500 },
  ask_next: { background: palette.stone100, color: palette.stone600 },
  conflict: { background: palette.gold100, color: palette.goldInk },
};

function ConflictAnswers({
  conflict,
  timeZone,
}: {
  conflict: OpenProgressConflictView;
  timeZone: string;
}) {
  return (
    <View style={{ marginTop: space.md, gap: space.sm }}>
      {conflict.adultAnswers.map((adultAnswer, index) => {
        const who = adultAnswer.adultDisplayName ?? `Adult ${index + 1}`;
        return (
          <View
            key={adultAnswer.evidenceId}
            style={{
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              borderRadius: radius.sm,
              backgroundColor: colors.card,
              padding: space.md,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: colors.textStrong,
              }}
            >
              {who}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.lg,
                color: colors.textStrong,
              }}
            >
              {progressAnswerLabel(adultAnswer.answer)}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: colors.textMuted,
              }}
            >
              {progressSourceLabel(adultAnswer.source.kind)}
              {" · "}
              {formatProgressDate(adultAnswer.observedAt, timeZone)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function TopicRow({
  topic,
  conflict,
  timeZone,
}: {
  topic: ProgressTopicView;
  conflict?: OpenProgressConflictView;
  timeZone: string;
}) {
  const tone = TOPIC_STATE_TONES[topic.state];
  const hasEvidence =
    topic.state === "observed_today" || topic.state === "older";

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radius.md,
        backgroundColor: colors.card,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: space.sm,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: fontFamilies.displaySemibold,
            fontSize: fontSize.base,
            lineHeight: fontSize.base * 1.3,
            color: colors.textStrong,
          }}
        >
          {topic.statement}
        </Text>
        <View
          style={{
            borderRadius: radius.pill,
            paddingHorizontal: 10,
            paddingVertical: 3,
            backgroundColor: tone.background,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodyBold,
              fontSize: 10,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              color: tone.color,
            }}
          >
            {progressTopicStateLabel(topic.state)}
          </Text>
        </View>
      </View>

      {hasEvidence ? (
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.lg,
              color: colors.textStrong,
            }}
          >
            {progressAnswerLabel(topic.answer)}
          </Text>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textBody,
            }}
          >
            {topic.detail}
            {topic.source.adultDisplayName
              ? ` Shared by ${topic.source.adultDisplayName}.`
              : ""}
          </Text>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            {formatProgressDate(topic.observedAt, timeZone)}
          </Text>
        </View>
      ) : topic.state === "ask_next" ? (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textBody,
          }}
        >
          Nothing shared on this yet. HOMA will ask about it at a good
          moment.
        </Text>
      ) : (
        <View>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textBody,
            }}
          >
            You each noticed something different. Both answers stay saved;
            confirming picks which one fits today.
          </Text>
          {conflict ? (
            <ConflictAnswers conflict={conflict} timeZone={timeZone} />
          ) : null}
        </View>
      )}
    </View>
  );
}

function DomainSection({
  domain,
  conflicts,
  timeZone,
}: {
  domain: ProgressDomainView;
  conflicts: readonly OpenProgressConflictView[];
  timeZone: string;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: fontSize.xs,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: colors.textMuted,
        }}
      >
        {domain.displayName}
      </Text>
      {domain.topics.map((topic) => (
        <TopicRow
          key={topic.itemId}
          topic={topic}
          conflict={conflicts.find(
            (candidate) => candidate.itemId === topic.itemId,
          )}
          timeZone={timeZone}
        />
      ))}
    </View>
  );
}

export function SubjectDetailSheet({
  childId,
  subject,
  tile,
  conflicts,
  timeZone,
  onClose,
  onAskHoma,
}: {
  childId: string;
  subject: ProgressSubjectView;
  tile: ProgressTileModel | null;
  conflicts: readonly OpenProgressConflictView[];
  timeZone: string;
  onClose: () => void;
  /** Opens chat focused on this child (mobile's AskHomaAboutChild). */
  onAskHoma: () => void;
}) {
  const summary = progressSubjectSummary(subject, timeZone);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Tap-catch scrim: any tap outside the sheet closes it. */}
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(51,42,33,0.42)" }}
      />
      <View
        style={{
          maxHeight: "78%",
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          borderTopWidth: 1,
          borderColor: colors.borderSubtle,
          backgroundColor: colors.card,
        }}
      >
        {/* The sheet's grabber: says "this slides away". */}
        <View
          style={{
            alignSelf: "center",
            marginTop: 10,
            width: 40,
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: palette.stone300,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: space.md,
            borderBottomWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <Text
              style={{
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.xl,
                color: colors.textStrong,
              }}
            >
              {subject.displayName}
            </Text>
            {tile?.badge ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  borderRadius: radius.pill,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  backgroundColor: tile.badge.background,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.bodyBold,
                    fontSize: fontSize.xs,
                    color: tile.badge.color,
                  }}
                >
                  {tile.badge.label}
                </Text>
              </View>
            ) : null}
            {summary ? (
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  lineHeight: fontSize.sm * 1.4,
                  color: colors.textBody,
                }}
              >
                {summary}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: pressed ? colors.brand : colors.borderSubtle,
              borderRadius: radius.pill,
              paddingHorizontal: space.md,
              paddingVertical: 6,
              backgroundColor: colors.card,
            })}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: colors.textStrong,
              }}
            >
              Close
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            gap: space.lg,
          }}
        >
          {subject.domains.map((domain) => (
            <DomainSection
              key={domain.domainId}
              domain={domain}
              conflicts={conflicts}
              timeZone={timeZone}
            />
          ))}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.borderSubtle,
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: space.lg,
            gap: space.sm,
          }}
        >
          {tile?.deeperCheck ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: palette.sage100,
                borderRadius: radius.sm,
                backgroundColor: colors.sageSoft,
                padding: space.md,
                gap: space.sm,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  lineHeight: fontSize.sm * 1.4,
                  color: colors.textBody,
                }}
              >
                This number comes from the answers above. Eight questions at
                most sharpen it and update the progress report, in about two
                minutes.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  // The deep dive walks the web onboarding flow, which
                  // owns the questions and the rescore; mobile links out
                  // rather than re-implementing a write path (same
                  // pattern as lib/web-links.ts).
                  void Linking.openURL(
                    `${env.apiUrl.replace(/\/+$/, "")}/onboarding?dd=${encodeURIComponent(childId)}.${encodeURIComponent(subject.subjectId)}`,
                  )
                }
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  borderRadius: radius.pill,
                  paddingHorizontal: space.md,
                  paddingVertical: 8,
                  backgroundColor: pressed ? colors.brandHover : colors.brand,
                })}
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.bodySemibold,
                    fontSize: fontSize.sm,
                    color: colors.onBrand,
                  }}
                >
                  Answer a few deeper questions
                </Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onAskHoma}
            style={{ minHeight: 40, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: colors.brand,
              }}
            >
              Tell HOMA something looks wrong
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
