import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import {
  getMapItem,
  personalizeStatement,
  type MapAnswer,
} from "@homa/core";

import { Card } from "../../components/ui/card";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import { fetchMapChild, saveChecklistAnswer } from "./onboarding-card-api";
import {
  checklistPositionFor,
  withChecklistAnswer,
  type MapStateChild,
} from "./onboarding-card-model";

const ANSWERS: readonly (readonly [MapAnswer, string])[] = [
  ["easily", "Easily"],
  ["getting_there", "Getting there"],
  ["not_yet", "Not yet"],
  ["not_sure", "Not sure"],
];

export interface ChecklistExit {
  childId: string;
  childName: string;
  answered: number;
  remaining: number;
  complete: boolean;
}

function exitFor(child: MapStateChild): ChecklistExit {
  const position = checklistPositionFor(child);
  return {
    childId: child.id,
    childName: child.name,
    answered: position.answered,
    remaining: position.remaining,
    complete: position.complete,
  };
}

export function ChecklistTakeover({
  childId,
  onClose,
}: {
  childId: string;
  onClose: (exit: ChecklistExit | null) => void;
}) {
  const [child, setChild] = useState<MapStateChild | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void fetchMapChild(childId)
      .then((next) => {
        if (current) setChild(next);
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : "The questions did not open.");
      });
    return () => {
      current = false;
    };
  }, [childId]);

  if (error && !child) {
    return (
      <Card style={{ gap: space.md }}>
        <Text accessibilityRole="alert" style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
          {error} Nothing you answered is lost.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => onClose(null)}>
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.brand }}>
            Back to the chat
          </Text>
        </Pressable>
      </Card>
    );
  }

  if (!child) {
    return (
      <Card style={{ alignItems: "center", paddingVertical: space.xl }}>
        <ActivityIndicator color={colors.brand} />
      </Card>
    );
  }

  const position = checklistPositionFor(child);
  const item = position.currentItem;
  const subject = item ? getMapItem(item.id)?.subject : null;
  const total = child.answered + position.remaining;
  const progress = total > 0 ? `${Math.round((child.answered / total) * 100)}%` as const : "0%";

  async function answer(value: MapAnswer) {
    if (!child || !item || pending) return;
    const activeChild = child;
    setPending(true);
    setError(null);
    try {
      await saveChecklistAnswer({ childId: activeChild.id, itemId: item.id, answer: value });
      const next = withChecklistAnswer(activeChild, item.id, value);
      setChild(next);
      if (checklistPositionFor(next).complete) {
        setTimeout(() => onClose(exitFor(next)), 140);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That answer did not save. Try it again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Text style={{ borderRadius: radius.pill, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 5, fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.brand }}>
            {child.name}
          </Text>
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textSubtle }}>
            {subject?.displayName ?? "Questions"}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to the chat" onPress={() => onClose(exitFor(child))} hitSlop={8}>
          <X size={21} color={colors.textSubtle} />
        </Pressable>
      </View>
      <View style={{ height: 4, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.borderSubtle }}>
        <View style={{ width: progress, height: 4, backgroundColor: colors.brand }} />
      </View>
      {item ? (
        <>
          <Text style={{ minHeight: 58, fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, lineHeight: 25, color: colors.textStrong }}>
            {personalizeStatement(child.name, item)}?
          </Text>
          <View style={{ gap: space.sm }}>
            {ANSWERS.map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                disabled={pending}
                onPress={() => void answer(value)}
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: "center",
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: pressed ? colors.brand : colors.border,
                  backgroundColor: pressed ? colors.brandSoft : colors.card,
                  paddingHorizontal: space.md,
                  opacity: pending ? 0.6 : 1,
                })}
              >
                <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.textStrong }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <Text style={{ fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, color: colors.textStrong }}>
          Questions complete
        </Text>
      )}
      {pending ? <ActivityIndicator color={colors.brand} /> : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
          {error}
        </Text>
      ) : null}
      <Text style={{ textAlign: "center", fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textSubtle }}>
        {position.remaining <= 1 ? "Almost done" : `About ${position.minutesLeft} min left. You can stop whenever you like.`}
      </Text>
    </Card>
  );
}
