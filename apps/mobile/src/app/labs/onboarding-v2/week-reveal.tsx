import type { MapAnswerInput } from "@homa/core";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton } from "../../../features/onboarding-v2/controls";
import { ageInMonthsFromParts, useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { buildWeek } from "../../../features/onboarding-v2/week";
import { v2Colors, v2Radii, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

export default function WeekRevealScreen() {
  const router = useRouter();
  const { state, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";
  const ageMonths = firstChild ? ageInMonthsFromParts(firstChild.birthMonth, firstChild.birthYear) : 60;
  const answers: MapAnswerInput[] = useMemo(() => Object.values(state.answers), [state.answers]);
  const week = useMemo(
    () => buildWeek(ageMonths, answers, state.schoolDays, state.startWithSubjectId, state.loving),
    [ageMonths, answers, state.schoolDays, state.startWithSubjectId, state.loving],
  );

  return (
    <OnboardingStage
      posture="big"
      characterState="speaking"
      bubbleKey="week-reveal"
      bubble={`Here's ${name}'s whole week, already on the calendar.`}
      footer={<PrimaryButton label="Continue" onPress={() => router.push("/labs/onboarding-v2/notifications")} />}
    >
      <View style={{ gap: v2Space.sm, paddingTop: v2Space.md }}>
        {week.days.map((day) => (
          <View
            key={day.day}
            style={{
              backgroundColor: v2Colors.paper,
              borderRadius: v2Radii.control,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: day.isStartWithSubject ? v2Colors.coral : v2Colors.border,
              padding: v2Space.md,
              gap: 2,
            }}
          >
            <NativeText style={[v2Type.caption, { color: v2Colors.coral }]}>{day.label}</NativeText>
            <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>{day.subject}</NativeText>
            <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>{day.detail}</NativeText>
          </View>
        ))}
        {!week.hasRealPlan ? (
          <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
            {"Answer a few more questions and I'll fill in the week."}
          </NativeText>
        ) : null}
      </View>
    </OnboardingStage>
  );
}
