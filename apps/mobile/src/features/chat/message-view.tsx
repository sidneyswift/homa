import { Pressable, Text, View } from "react-native";
import type { EveMessage, EveMessagePart } from "eve/react";

import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { fontFamilies , colors, fontSize, radius, shadows, space } from "../../theme/app2";
import { MarkdownText } from "./markdown-text";
import {
  approvedOutboundChildFramingTexts,
  memoryChipFor,
  partIsRenderable,
  toolOnlyFallback,
  userMessageSendState,
  visibleMobileChildFramingText,
  type MemoryChipContent,
} from "./message-utils";
import { MaterialCard, type MaterialArtifact } from "./material-card";
import { MaterialPrintCard } from "./material-print-card";
import { parseMaterialPrintPart } from "@homa/core";
import { LibrarySourceCard } from "./library-source-card";
import { parseLibrarySourceCardPart } from "./library-source-card-model";
import { CurriculumMappingCard } from "./curriculum-mapping-card";
import { parseCurriculumMappingCardPart } from "./curriculum-mapping-card-model";
import { PlannerCard } from "./planner-card";
import { QuestionCard } from "./question-card";
import { parseQuestionCardPart } from "./question-card-model";
import {
  ChecklistCard,
  DetailCard,
  ReportRevealCard,
} from "./onboarding-cards";
import {
  parseChecklistCardPart,
  parseDetailCardPart,
  parseReportCardPart,
} from "./onboarding-card-model";

/** Transcript bubbles, the mobile twin of apps/web's message-parts.tsx. */

function MemoryChip({ chip }: { chip: MemoryChipContent }) {
  return (
    <View
      style={{
        marginTop: space.sm,
        flexDirection: "row",
        alignSelf: "flex-start",
        alignItems: "baseline",
        gap: 6,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.sageSoft,
        backgroundColor: colors.sageSoft,
        paddingHorizontal: 12,
        paddingVertical: 6,
        maxWidth: "100%",
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: fontSize.xs,
          color: colors.success,
        }}
      >
        {chip.label}
      </Text>
      {chip.detail ? (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.xs,
            color: colors.textBody,
            flexShrink: 1,
          }}
        >
          {chip.detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Everything the transcript needs to hand a choice card its taps. */
export interface QuestionCardWiring {
  /** The one card that may still be answered, from latestQuestionRequest. */
  activeQuestionPartKey?: string;
  onSendQuestionAnswers?: (message: string) => void;
  onQuestionTypeInstead?: () => void;
  /** partKey -> what she already sent from that card. */
  questionAnswers?: Record<string, string>;
}

export interface OnboardingCardWiring {
  activeChecklistPartKey?: string;
  activeDetailPartKey?: string;
  activeReportPartKey?: string;
  onOpenChecklist?: (childId: string) => void;
  onDetailsSaved?: (summary: string) => void;
}

function MessagePartView({
  part,
  partKey,
  isUser,
  current,
  assistantText,
  questions,
  onboarding,
}: {
  part: EveMessagePart;
  partKey: string;
  isUser: boolean;
  current: boolean;
  assistantText?: string | null;
  questions: QuestionCardWiring;
  onboarding: OnboardingCardWiring;
}) {
  if (part.type === "text") {
    if (isUser) {
      // App 2: her earlier words recede to grey; the newest line stays in ink.
      return (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            lineHeight: fontSize.base * 1.5,
            color: current ? colors.textStrong : colors.textMuted,
            textAlign: "right",
          }}
        >
          {part.text}
        </Text>
      );
    }
    return assistantText === null
      ? null
      : <MarkdownText text={assistantText ?? part.text} />;
  }
  if (part.type === "dynamic-tool" && part.state === "output-available") {
    const questionCard = parseQuestionCardPart(part);
    if (questionCard) {
      // Only the newest unanswered card takes taps; every older one
      // renders settled so a spent option never looks pressable.
      const live = partKey === questions.activeQuestionPartKey;
      return (
        <View style={{ marginTop: space.sm }}>
          <QuestionCard
            card={questionCard}
            active={live}
            onSendAnswers={live ? questions.onSendQuestionAnswers : undefined}
            onTypeInstead={live ? questions.onQuestionTypeInstead : undefined}
            answeredSummary={questions.questionAnswers?.[partKey] ?? null}
          />
        </View>
      );
    }
    const checklistCard = parseChecklistCardPart(part);
    if (checklistCard) {
      const live = partKey === onboarding.activeChecklistPartKey;
      return (
        <View style={{ marginTop: space.sm }}>
          <ChecklistCard
            card={checklistCard}
            active={live}
            onOpen={live ? onboarding.onOpenChecklist : undefined}
          />
        </View>
      );
    }
    const detailCard = parseDetailCardPart(part);
    if (detailCard) {
      const live = partKey === onboarding.activeDetailPartKey;
      return (
        <View style={{ marginTop: space.sm }}>
          <DetailCard
            card={detailCard}
            active={live}
            onSaved={live ? onboarding.onDetailsSaved : undefined}
          />
        </View>
      );
    }
    const reportCard = parseReportCardPart(part);
    if (reportCard) {
      return (
        <View style={{ marginTop: space.sm }}>
          <ReportRevealCard
            card={reportCard}
            active={partKey === onboarding.activeReportPartKey}
          />
        </View>
      );
    }
    const librarySource = parseLibrarySourceCardPart(part);
    if (librarySource) {
      return (
        <View style={{ marginTop: space.sm }}>
          <LibrarySourceCard source={librarySource} />
        </View>
      );
    }
    const curriculumMapping = parseCurriculumMappingCardPart(part);
    if (curriculumMapping) {
      return (
        <View style={{ marginTop: space.sm }}>
          <CurriculumMappingCard card={curriculumMapping} />
        </View>
      );
    }
    const printHandoff = parseMaterialPrintPart(part);
    if (printHandoff) return <MaterialPrintCard handoff={printHandoff} />;
    if (part.toolName === "open_planner") {
      const output = part.output as
        | { opened?: boolean; childName?: string | null }
        | undefined;
      if (output?.opened) {
        return (
          <View style={{ marginTop: space.sm }}>
            <PlannerCard childName={output.childName ?? null} />
          </View>
        );
      }
      return null;
    }
    if (
      part.toolName === "create_printable" ||
      part.toolName === "show_material" ||
      part.toolName === "create_worksheet"
    ) {
      // show_material re-surfaces an existing material as the same
      // card; create_worksheet is the retired v1 name (legacy
      // transcripts).
      const output = part.output as
        | { material?: MaterialArtifact; worksheet?: MaterialArtifact }
        | undefined;
      const material = output?.material ?? output?.worksheet;
      // previewUrl guards out refusals and pre-studio legacy payloads.
      if (material?.previewUrl) {
        return (
          <View style={{ marginTop: space.sm }}>
            <MaterialCard material={material} />
          </View>
        );
      }
      return null;
    }
    const chip = memoryChipFor(part);
    if (chip) return <MemoryChip chip={chip} />;
  }
  return null;
}

/** The plain text a retry resends: every text part joined the same way
 *  sendMessage joins a held-back queue. Mobile carries no attachment
 *  markers to strip (unlike the web twin), so this is the whole story. */
function userMessageText(message: EveMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

export function MessageView({
  message,
  current = false,
  questions = {},
  onboarding = {},
  onRetryFailedMessage,
}: {
  message: EveMessage;
  /** The newest message in the transcript, which App 2 keeps in full ink. */
  current?: boolean;
  questions?: QuestionCardWiring;
  onboarding?: OnboardingCardWiring;
  /** Resends this exact text (a card-equivalent send, so the existing
   *  session-fork guard and queueing apply the same as any other send).
   *  Undefined only hides the retry control, never the "Not sent" state
   *  itself: a message that failed to send stays honest either way. */
  onRetryFailedMessage?: (text: string) => void;
}) {
  const isUser = message.role === "user";
  const approvedChildFramingTexts = approvedOutboundChildFramingTexts(
    message.parts,
  );
  const messageIsStreaming = message.metadata?.status === "streaming";
  const assistantTextByPart = new Map<number, string | null>();
  if (!isUser) {
    for (const [index, part] of message.parts.entries()) {
      if (part.type !== "text") continue;
      assistantTextByPart.set(
        index,
        visibleMobileChildFramingText({
          text: part.text,
          approvedTexts: approvedChildFramingTexts,
          streaming: messageIsStreaming,
        }),
      );
    }
  }
  const fallback = toolOnlyFallback(message);
  const hasRenderablePart = message.parts.some((part, index) =>
    !isUser && part.type === "text"
      ? (assistantTextByPart.get(index)?.trim().length ?? 0) > 0
      : partIsRenderable(part),
  );
  if (!hasRenderablePart && fallback === null) return null;
  // Where a user bubble sits between typed and delivered (GH #170 part
  // 2, message-utils.ts): never set for an assistant message.
  const sendState = isUser ? userMessageSendState(message) : null;

  return (
    <View
      style={{
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 4,
      }}
    >
      <View
        style={{
          // App 2 transcript: no bubbles. Homa's reply uses the full
          // column; hers sits right, inset from the edge (web .spokenTurn).
          maxWidth: isUser ? "85%" : "100%",
          width: isUser ? undefined : "100%",
          // A message still finding out whether it landed, or one that
          // did not, dims: quieter, never hidden (no pending/failed state
          // existed before GH #170; a dropped connection used to erase
          // her words with no sign anything was wrong).
          opacity: isUser && sendState !== null ? 0.7 : 1,
        }}
      >
        {message.parts.map((part, index) => (
          <MessagePartView
            key={index}
            part={part}
            // Same key latestQuestionRequest builds, so the live card
            // and only the live card recognises itself.
            partKey={`${message.id}:${index}`}
            isUser={isUser}
            current={current}
            assistantText={assistantTextByPart.get(index)}
            questions={questions}
            onboarding={onboarding}
          />
        ))}
        {fallback ? (
          <Text
            accessibilityRole="alert"
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              lineHeight: fontSize.base * 1.5,
              color: colors.textBody,
            }}
          >
            {fallback}
          </Text>
        ) : null}
      </View>
      {sendState === "sending" ? (
        <Text
          accessibilityRole="text"
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.xs,
            color: colors.textMuted,
          }}
        >
          Sending&hellip;
        </Text>
      ) : sendState === "failed" ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
        >
          <Text
            accessibilityRole="alert"
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.xs,
              color: colors.textBody,
            }}
          >
            Not sent.
          </Text>
          {onRetryFailedMessage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry"
              onPress={() => onRetryFailedMessage(userMessageText(message))}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.xs,
                  color: colors.textBody,
                  textDecorationLine: "underline",
                }}
              >
                Retry
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The "thinking" or tool-status bubble shown while a turn is running. */
export function BusyBubble({ label }: { label: string }) {
  useAccessibilityAnnouncement(label);
  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-start" }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderBottomLeftRadius: radius.sm,
          paddingHorizontal: space.md,
          paddingVertical: 12,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            color: colors.textMuted,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Floats above the composer when a reply lands while she's scrolled away
 *  rereading (Carolyng feedback, 2026-08-24): a tap returns her to it,
 *  instead of the turn yanking her there itself. */
export function NewReplyPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        alignSelf: "center",
        backgroundColor: colors.textStrong,
        borderRadius: radius.lg,
        paddingHorizontal: space.md,
        paddingVertical: 10,
        opacity: pressed ? 0.85 : 1,
        ...shadows.sm,
      })}
    >
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          color: colors.card,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
