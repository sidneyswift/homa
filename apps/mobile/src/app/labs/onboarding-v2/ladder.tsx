import { MAP_SUBJECTS, maxQuestionsForAge, type MapAnswer } from "@homa/core";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { RadioRow, TextLink } from "../../../features/onboarding-v2/controls";
import {
  advanceCursor,
  buildLadderPlans,
  INITIAL_CURSOR,
  stepFor,
  type SubjectCursor,
} from "../../../features/onboarding-v2/ladder";
import { ageInMonthsFromParts, useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

const ANSWER_OPTIONS: { value: MapAnswer; label: string }[] = [
  { value: "easily", label: "Easily" },
  { value: "getting_there", label: "Getting there" },
  { value: "not_yet", label: "Not yet" },
  { value: "not_sure", label: "Not sure" },
];

/** Sixteen subjects, walked with @homa/core's real selection ladder
 * (features/onboarding-v2/ladder.ts): one base item per subject, one
 * guaranteed floor question below it on "not yet", and upward rungs on
 * "easily" until the subject caps or she stops climbing. */
export default function LadderScreen() {
  const router = useRouter();
  const { setAnswer, firstChild } = useOnboardingV2();
  const ageMonths = firstChild ? ageInMonthsFromParts(firstChild.birthMonth, firstChild.birthYear) : 60;
  const plans = useMemo(() => buildLadderPlans(ageMonths), [ageMonths]);
  const totalEstimate = useMemo(() => Math.max(1, maxQuestionsForAge(ageMonths)), [ageMonths]);

  const [subjectIndex, setSubjectIndex] = useState(0);
  const [cursor, setCursor] = useState<SubjectCursor>(INITIAL_CURSOR);
  const [answeredCount, setAnsweredCount] = useState(0);

  const step = stepFor(plans, subjectIndex, cursor);
  const domain = step ? MAP_SUBJECTS.find((s) => s.id === step.subjectId) ?? null : null;

  if (!step || !domain) return null;

  function submit(answer: MapAnswer) {
    if (!step) return;
    setAnswer(step.item.id, answer);
    setAnsweredCount((n) => n + 1);
    const next = advanceCursor(plans, subjectIndex, cursor, answer);
    if (next.phase === "done") {
      if (subjectIndex + 1 < plans.length) {
        setSubjectIndex((i) => i + 1);
        setCursor(INITIAL_CURSOR);
      } else {
        router.push("/labs/onboarding-v2/school-days");
      }
    } else {
      setCursor(next);
    }
  }

  const progress = 0.5 + 0.28 * Math.min(1, answeredCount / totalEstimate);

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      progress={progress}
      bubbleKey={step.item.id}
      bubble={
        <View style={{ gap: 4 }}>
          <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>{step.subjectDisplayName}</NativeText>
          <NativeText style={[v2Type.question, { color: v2Colors.ink }]}>{step.item.statement}</NativeText>
        </View>
      }
    >
      <View style={{ gap: v2Space.sm }}>
        {ANSWER_OPTIONS.map((option) => (
          <RadioRow key={option.value} label={option.label} selected={false} onPress={() => submit(option.value)} />
        ))}
        {domain.exposureBased ? (
          <View style={{ paddingTop: v2Space.sm }}>
            <TextLink label="Skip this one" onPress={() => submit("skip")} />
          </View>
        ) : null}
      </View>
    </OnboardingStage>
  );
}
