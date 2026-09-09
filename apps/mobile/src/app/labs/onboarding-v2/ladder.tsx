import { MAP_SUBJECTS, type MapAnswer } from "@homa/core";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { RadioRow, PrimaryButton, TextLink } from "../../../features/onboarding-v2/controls";
import { buildLadderPlans, stepFor } from "../../../features/onboarding-v2/ladder";
import { nextPosition, resumeQuestions, sessionAnswers, type QuestionSession } from "../../../features/onboarding-v2/question-session";
import { ageInMonthsFromParts, useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

const ANSWER_OPTIONS: { value: MapAnswer; label: string }[] = [
  { value: "easily", label: "Easily" },
  { value: "getting_there", label: "Getting there" },
  { value: "not_yet", label: "Not yet" },
  { value: "not_sure", label: "Not sure" },
];

export default function LadderScreen() {
  const router = useRouter();
  const { state, update, firstChild } = useOnboardingV2();
  const ageMonths = firstChild ? ageInMonthsFromParts(firstChild.birthMonth, firstChild.birthYear) : 60;
  const plans = useMemo(() => buildLadderPlans(ageMonths), [ageMonths]);
  const [session, setSession] = useState<QuestionSession>(() => resumeQuestions(plans, state.answers));
  const { subjectIndex, cursor, selected, history } = session;
  const step = stepFor(plans, subjectIndex, cursor);

  function submit() {
    if (!step || selected === null) return;
    update("answers", sessionAnswers(plans, session));
    const next = nextPosition(plans, session, selected);
    if (!next) { router.push("/labs/onboarding-v2/school-days"); return; }
    setSession({ ...next, history: [...history, { subjectIndex, cursor, answer: selected }], selected: null });
  }

  function back() {
    const previous = history.at(-1);
    if (!previous) { router.back(); return; }
    setSession({ subjectIndex: previous.subjectIndex, cursor: previous.cursor,
      history: history.slice(0, -1), selected: previous.answer });
  }

  function finish() {
    update("answers", sessionAnswers(plans, session));
    router.push("/labs/onboarding-v2/school-days");
  }

  if (!step) return null;
  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={back}
      progressLabel={`${subjectIndex + 1} of ${plans.length} subjects`} bubbleKey={step.item.id}
      bubble={<View style={{ gap: v2Space.xs }}>
        <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>{step.subjectDisplayName}</NativeText>
        <NativeText style={[v2Type.question, { color: v2Colors.ink }]}>{step.item.statement}</NativeText>
      </View>}
      footer={<View style={{ gap: v2Space.sm }}>
        <TextLink label="Finish questions for now" onPress={finish} disabled={selected === null && history.length === 0} />
        <PrimaryButton label="Continue" onPress={submit} disabled={selected === null} />
      </View>}
    >
      <View style={{ gap: v2Space.sm }}>
        {ANSWER_OPTIONS.map((option) => <RadioRow key={option.value} label={option.label}
          selected={selected === option.value} onPress={() => setSession({ ...session, selected: option.value })} />)}
        {MAP_SUBJECTS.find((subject) => subject.id === step.subjectId)?.exposureBased ? (
          <RadioRow label="We haven't tried this" selected={selected === "skip"}
            onPress={() => setSession({ ...session, selected: "skip" })} />
        ) : null}
      </View>
    </OnboardingStage>
  );
}
