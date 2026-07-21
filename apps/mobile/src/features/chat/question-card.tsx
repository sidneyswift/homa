import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Logo } from "../../components/brand/logo";
import { Card } from "../../components/ui/card";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import {
  cardSignature,
  composeAnswerMessage,
  type QuestionCardData,
} from "./question-card-model";

/**
 * The choice card on the phone, the mobile twin of
 * apps/web/app/app/question-card.tsx: when Homa asks the parent to pick
 * (agent/tools/ask_user_questions.ts), the ask renders as a stepped card
 * with tappable options, one question on screen at a time so the parent
 * never faces a wall of decisions. Her taps collect locally and send as
 * ONE ordinary message when the last question is answered, because every
 * send starts a full turn and Homa must not reply halfway through the
 * card.
 *
 * "Type something else" and "Skip" are always there: the card is an
 * offer, never a gate. Nothing is recorded anywhere until she sends.
 */

/** The tick beside a chosen option. Mobile carries no icon set. */
const CHECK = "✓";

/** Options of a spent card read as a quiet list, separated by a mid-dot. */
const DOT = " · ";

function CardHeading({
  label,
  step,
}: {
  label: string;
  step: string | null;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
        <Logo size={15} variant="mark" />
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontFamily: fontFamilies.bodyBold,
            fontSize: fontSize.xs,
            textTransform: "uppercase",
            color: colors.textSubtle,
          }}
        >
          {label}
        </Text>
      </View>
      {step ? (
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.xs,
            color: colors.textSubtle,
          }}
        >
          {step}
        </Text>
      ) : null}
    </View>
  );
}

function TextAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      {({ pressed }) => (
        <Text
          style={{
            fontFamily: fontFamilies.bodyMedium,
            fontSize: fontSize.sm,
            color: pressed ? colors.textStrong : colors.textMuted,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function QuestionCard({
  card,
  active,
  onSendAnswers,
  onTypeInstead,
  answeredSummary = null,
}: {
  card: QuestionCardData;
  active: boolean;
  onSendAnswers?: (message: string) => void;
  onTypeInstead?: () => void;
  /** What she sent from THIS card, once she has. */
  answeredSummary?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[][]>(() =>
    card.questions.map(() => []),
  );
  // Both guards mirror web's question-card.tsx, where clicking the real
  // card exposed them. A useState initializer runs once, so a card that
  // later arrives with a different question count left `answers` at the
  // old length and every tap silently did nothing. Reset during render on
  // the card's signature, React's documented way to adjust state to a
  // changed prop.
  const [signature, setSignature] = useState(() => cardSignature(card));
  const currentSignature = cardSignature(card);
  if (signature !== currentSignature) {
    setSignature(currentSignature);
    setStep(0);
    setAnswers(card.questions.map(() => []));
  }

  const total = card.questions.length;
  const question = card.questions[Math.min(step, total - 1)];
  const picked = answers[step] ?? [];
  const spent = !active || onSendAnswers === undefined;


  /**
   * Every write uses the updater form. Reading `answers` from the render
   * closure loses a tap: two picks in one batch both start from the same
   * stale array, so the second overwrites the first and a fast
   * multi-select silently drops a day.
   */
  function updateStep(make: (entry: readonly string[]) => string[]) {
    setAnswers((current) =>
      current.map((entry, index) => (index === step ? make(entry) : entry)),
    );
  }

  function commit(make: (entry: readonly string[]) => string[]) {
    // Computed once and used for BOTH the state write and the send, so the
    // message can never describe a different set of answers than the card
    // ends up holding.
    const next = answers.map((entry, index) =>
      index === step ? make(entry) : entry,
    );
    setAnswers(next);
    if (step + 1 < total) setStep(step + 1);
    else onSendAnswers?.(composeAnswerMessage(card.questions, next));
  }

  function onPick(label: string) {
    if (question.multiSelect) {
      updateStep((entry) =>
        entry.includes(label)
          ? entry.filter((value) => value !== label)
          : [...entry, label],
      );
      return;
    }
    commit(() => [label]);
  }

  function onSkip() {
    commit(() => []);
  }

  if (answeredSummary !== null) {
    return (
      <Card style={{ padding: space.md, gap: space.sm }}>
        <CardHeading
          label={total === 1 ? "One question" : `${total} questions`}
          step={null}
        />
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          <Text
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.sm,
              color: colors.sage,
            }}
          >
            {CHECK}
          </Text>
          <Text
            style={{
              flexShrink: 1,
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.sm,
              lineHeight: fontSize.sm * 1.5,
              color: colors.sage,
            }}
          >
            {`You said: ${answeredSummary}`}
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ padding: space.md, gap: space.sm }}>
      <CardHeading
        label={question.header || "One question"}
        step={total > 1 ? `${step + 1}/${total}` : null}
      />
      <Text
        style={{
          fontFamily: fontFamilies.displaySemibold,
          fontSize: fontSize.lg,
          lineHeight: fontSize.lg * 1.35,
          color: colors.textStrong,
        }}
      >
        {question.question}
      </Text>
      {question.multiSelect && !spent ? (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textMuted,
          }}
        >
          Pick as many as fit.
        </Text>
      ) : null}

      {spent ? (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * 1.5,
            color: colors.textSubtle,
          }}
        >
          {question.options.map((option) => option.label).join(DOT)}
        </Text>
      ) : (
        <>
          <View style={{ gap: space.sm }}>
            {question.options.map((option) => {
              const on = picked.includes(option.label);
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={
                    question.multiSelect ? { selected: on } : undefined
                  }
                  onPress={() => onPick(option.label)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: space.sm,
                    minHeight: 48,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: on || pressed ? colors.brand : colors.border,
                    backgroundColor: on ? colors.brandSoft : colors.page,
                    paddingHorizontal: space.md,
                    paddingVertical: 12,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontFamily: fontFamilies.bodySemibold,
                        fontSize: fontSize.base,
                        color: colors.textStrong,
                      }}
                    >
                      {option.label}
                    </Text>
                    {option.description ? (
                      <Text
                        style={{
                          fontFamily: fontFamilies.body,
                          fontSize: fontSize.sm,
                          lineHeight: fontSize.sm * 1.45,
                          color: colors.textMuted,
                        }}
                      >
                        {option.description}
                      </Text>
                    ) : null}
                  </View>
                  {question.multiSelect && on ? (
                    <Text
                      style={{
                        fontFamily: fontFamilies.bodySemibold,
                        fontSize: fontSize.base,
                        color: colors.brand,
                      }}
                    >
                      {CHECK}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: space.md,
              borderTopWidth: 1,
              borderTopColor: colors.borderSubtle,
              paddingTop: space.sm,
            }}
          >
            {question.multiSelect ? (
              <Pressable
                accessibilityRole="button"
                disabled={picked.length === 0}
                onPress={() => commit((entry) => [...entry])}
                style={({ pressed }) => ({
                  minHeight: 44,
                  borderRadius: radius.pill,
                  backgroundColor: pressed ? colors.brandHover : colors.brand,
                  paddingHorizontal: space.lg,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: picked.length === 0 ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.bodySemibold,
                    fontSize: fontSize.sm,
                    color: colors.onBrand,
                  }}
                >
                  {step + 1 < total ? "Next" : "Done"}
                </Text>
              </Pressable>
            ) : null}
            {onTypeInstead ? (
              <TextAction label="Type something else" onPress={onTypeInstead} />
            ) : null}
            <TextAction label="Skip" onPress={onSkip} />
          </View>
        </>
      )}
    </Card>
  );
}
