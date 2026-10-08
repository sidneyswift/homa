import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  getMapItem,
  personalizeStatement,
  type MapAnswer,
} from "@homa/core";

import { Button } from "../../components/ui/button";
import { Icon } from "../../components/design/icon";
import { Card } from "../../components/ui/card";
import { IconButton } from "../../components/ui/icon-button";
import { InlineError } from "../../components/ui/inline-error";
import { LoadingStatus } from "../../components/ui/loading-status";
import { useAccessibilityFocusOnChange } from "../../lib/accessibility";
import { hapticSuccess, hapticTick } from "../../lib/haptics";
import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";
import { fetchMapChild, saveChecklistAnswer } from "./onboarding-card-api";
import {
  checklistChaptersFor,
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
  onPosition,
  closeLabel = "Back to the chat",
  doneLabel,
}: {
  childId: string;
  onClose: (exit: ChecklistExit | null) => void;
  /** Fired with the current exit shape when the questions load and
   *  after every saved answer, so a host screen can close this session
   *  from OUTSIDE through the same one close path (the making screen's
   *  ready banner; D8 collapsed its old finalize-skipping bypass, spec
   *  Outcome 6). Never fired for a session that failed to load. */
  onPosition?: (exit: ChecklistExit) => void;
  /** Chat is this component's original and still-default home; a
   *  non-chat mount (e.g. the onboarding making screen) names its own
   *  exit instead of promising a chat that is not there. */
  closeLabel?: string;
  /** The completion button when finishing means something different
   *  from stopping early (the making screen's finish goes to the
   *  reveal). Defaults to closeLabel. */
  doneLabel?: string;
}) {
  const [child, setChild] = useState<MapStateChild | null>(null);
  const [pending, setPending] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // D15 receipt beat: set when the last saved answer closed its subject
  // chapter; rendered once above the next question, then cleared by the
  // next answer. Deterministic template, never a model call.
  const [receipt, setReceipt] = useState<string | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState(0);
  const questionHeadingRef = useRef<View>(null);
  const onPositionRef = useRef(onPosition);
  useEffect(() => {
    onPositionRef.current = onPosition;
  }, [onPosition]);
  const focusKey = child
    ? (checklistPositionFor(child).currentItem?.id ?? "complete")
    : null;
  useAccessibilityFocusOnChange(questionHeadingRef, focusKey, () => setTransitioning(false));

  useEffect(() => {
    let current = true;
    void fetchMapChild(childId)
      .then((next) => {
        if (current) {
          setChild(next);
          onPositionRef.current?.(exitFor(next));
        }
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
        <InlineError message={`${error} Nothing you answered is lost.`} />
        <Button label={closeLabel} variant="secondary" onPress={() => onClose(null)} />
      </Card>
    );
  }

  if (!child) {
    return (
      <Card style={{ alignItems: "center", paddingVertical: space.xl }}>
        <LoadingStatus label="Loading questions" />
      </Card>
    );
  }

  const position = checklistPositionFor(child);
  const item = position.currentItem;
  const subject = item ? getMapItem(item.id)?.subject : null;
  const chapterPosition = checklistChaptersFor(child);

  async function answer(value: MapAnswer) {
    if (!child || !item || pending || transitioning) return;
    hapticTick();
    const activeChild = child;
    setPending(true);
    setError(null);
    try {
      await saveChecklistAnswer({ childId: activeChild.id, itemId: item.id, answer: value });
      const next = withChecklistAnswer(activeChild, item.id, value);
      // The receipt beat (D15): if that answer closed its subject's
      // chapter, say so, with the running answer count.
      const answeredSubjectId = getMapItem(item.id)?.subject.id ?? null;
      const nextChapters = checklistChaptersFor(next);
      const closed = nextChapters.chapters.find(
        (chapter) => chapter.subjectId === answeredSubjectId && chapter.state === "done",
      );
      setReceipt(
        closed ? `That's ${closed.subjectName} done. ${next.answered} answers so far.` : null,
      );
      // D16: chapter complete is one of the three success moments.
      if (closed) hapticSuccess();
      setSessionAnswers((count) => count + 1);
      setTransitioning(true);
      setChild(next);
      onPositionRef.current?.(exitFor(next));
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
          <Text style={{ borderRadius: radius.pill, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 5, fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textStrong }}>
            {child.name}
          </Text>
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
            {subject && chapterPosition.currentIndex
              ? `${subject.displayName} · ${chapterPosition.currentIndex} of ${chapterPosition.totalChapters}`
              : (subject?.displayName ?? "Questions")}
          </Text>
        </View>
        <IconButton
          label={closeLabel}
          onPress={() => onClose(exitFor(child))}
          testID="checklist.close"
        >
          <Icon name="close" size={20} color={colors.textSubtle} />
        </IconButton>
      </View>
      {/* D15: chapters are the progress grammar. One segment per subject
          chapter (the Noom pattern), the only total the adaptive ladder
          makes deterministic; a time estimate never renders here. */}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Chapter progress"
        accessibilityValue={{
          min: 0,
          max: chapterPosition.totalChapters,
          now: chapterPosition.chapters.filter((chapter) => chapter.state === "done").length,
          text: chapterPosition.currentIndex
            ? `Chapter ${chapterPosition.currentIndex} of ${chapterPosition.totalChapters}`
            : "Chapters complete",
        }}
        style={{ flexDirection: "row", gap: 3 }}
      >
        {chapterPosition.chapters.map((chapter) => (
          <View
            key={chapter.subjectId}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              flex: 1,
              height: 4,
              borderRadius: radius.pill,
              overflow: "hidden",
              backgroundColor: colors.borderSubtle,
            }}
          >
            <View
              style={{
                width:
                  chapter.state === "done"
                    ? "100%"
                    : chapter.state === "current" && chapter.answered > 0
                      ? "50%"
                      : "0%",
                height: 4,
                backgroundColor: colors.brand,
              }}
            />
          </View>
        ))}
      </View>
      {receipt ? (
        <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
          {receipt}
        </Text>
      ) : null}
      {sessionAnswers === 0 && item ? (
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
          You can stop whenever you like.
        </Text>
      ) : null}
      {item ? (
        <>
          <View
            ref={questionHeadingRef}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${subject?.displayName ?? "Questions"}, chapter ${chapterPosition.currentIndex ?? chapterPosition.totalChapters} of ${chapterPosition.totalChapters}. ${personalizeStatement(child.name, item)}?`}
          >
            <Text style={{ minHeight: 58, fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, lineHeight: 25, color: colors.textStrong }}>
              {personalizeStatement(child.name, item)}?
            </Text>
          </View>
          <View style={{ gap: space.sm }}>
            {ANSWERS.map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ disabled: pending || transitioning }}
                disabled={pending || transitioning}
                testID={`checklist.answer.${value}`}
                onPress={() => void answer(value)}
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: "center",
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: pressed ? colors.brand : colors.border,
                  backgroundColor: pressed ? colors.brandSoft : colors.card,
                  paddingHorizontal: space.md,
                  opacity: pending || transitioning ? 0.6 : 1,
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
        <View style={{ gap: space.md }}>
          <View
            ref={questionHeadingRef}
            accessible
            accessibilityRole="header"
            accessibilityLabel="Questions complete"
          >
            <Text style={{ fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, color: colors.textStrong }}>
              Questions complete
            </Text>
          </View>
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}>
            {`Every answer is saved. They become ${child.name}'s progress report.`}
          </Text>
          <Button
            label={doneLabel ?? closeLabel}
            onPress={() => onClose(exitFor(child))}
            testID="checklist.done"
          />
        </View>
      )}
      {pending ? <LoadingStatus label="Saving answer" showLabel={false} /> : null}
      {error ? <InlineError message={error} /> : null}
    </Card>
  );
}
