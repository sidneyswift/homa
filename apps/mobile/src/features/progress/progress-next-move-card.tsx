import type { ProgressNextMove } from "@homa/core";
import { Pressable, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";

export function ProgressNextMoveCard({
  nextMove,
  onOpenChat,
  onDismiss,
  dismissing,
  dismissError,
}: {
  nextMove: Exclude<ProgressNextMove, { kind: "none" }>;
  onOpenChat: (draft: string) => void;
  onDismiss: () => void;
  dismissing: boolean;
  dismissError: string | null;
}) {
  const isMove = nextMove.kind === "move";
  const sources = isMove
    ? [...new Set(nextMove.evidence.map((row) => row.receipt))]
    : [];
  return (
    <Card
      style={{
        gap: space.md,
        backgroundColor: colors.brandSoft,
        borderColor: colors.brandHover,
      }}
    >
      <View style={{ gap: space.xs }}>
        {sources.map((source) => (
          <Text
            key={source}
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.xs,
              color: colors.textBody,
            }}
          >
            {source}
          </Text>
        ))}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: space.sm,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              minWidth: 180,
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.lg,
              color: colors.textStrong,
            }}
          >
            {isMove ? "A small idea for today" : nextMove.title}
          </Text>
          {isMove ? (
            <View
              style={{
                minHeight: 32,
                paddingHorizontal: space.sm,
                borderRadius: radius.pill,
                backgroundColor: colors.card,
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.xs,
                  color: colors.textBody,
                }}
              >
                {nextMove.minutes} min
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {isMove ? (
        <Text
          accessibilityLabel={`Working on ${nextMove.targetStatement}`}
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.xs,
            color: colors.textBody,
          }}
        >
          Working on: {nextMove.targetStatement}
        </Text>
      ) : null}

      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: fontSize.base,
          lineHeight: fontSize.base * 1.45,
          color: colors.textStrong,
        }}
      >
        {isMove ? nextMove.activity : nextMove.question}
      </Text>
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          lineHeight: fontSize.sm * 1.5,
          color: colors.textBody,
        }}
      >
        {nextMove.why}
      </Text>

      <View style={{ gap: space.sm }}>
        <Button
          label={isMove ? "Adjust in Chat" : "Answer in Chat"}
          accessibilityHint="Opens an editable draft. Nothing sends until you tap Send."
          onPress={() => onOpenChat(nextMove.chatDraft)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not today"
          accessibilityHint="Hides this suggestion until tomorrow."
          accessibilityState={{ disabled: dismissing, busy: dismissing }}
          disabled={dismissing}
          onPress={onDismiss}
          style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.sm,
              color: colors.textBody,
              opacity: dismissing ? 0.6 : 1,
            }}
          >
            {dismissing ? "Hiding…" : "Not today"}
          </Text>
        </Pressable>
        {dismissError ? (
          <Text
            accessibilityRole="alert"
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textBody,
              textAlign: "center",
            }}
          >
            {dismissError}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
