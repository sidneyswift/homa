import { lockedReportSubjects, MAP_SUBJECTS, scoreMap, type MapAnswerInput } from "@homa/core";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton, TextLink } from "../../../features/onboarding-v2/controls";
import { ageInMonthsFromParts, useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Radii, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

/** Keep the core report lock; describe parents' observations without grading the child. */
export default function ReportScreen() {
  const router = useRouter();
  const { state, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "Your child";
  const ageMonths = firstChild ? ageInMonthsFromParts(firstChild.birthMonth, firstChild.birthYear) : 60;
  const answers: MapAnswerInput[] = useMemo(() => Object.values(state.answers), [state.answers]);
  const scores = useMemo(() => scoreMap(ageMonths, answers), [ageMonths, answers]);
  const lockedIds = useMemo(() => new Set(lockedReportSubjects(scores)), [scores]);
  const mappedSubjects = scores.subjects.filter((subject) => subject.position !== "not_mapped");
  const hasObservations = mappedSubjects.length > 0;

  return (
    <OnboardingStage posture="plain" onBack={() => router.back()}
      bubbleKey="report" bubble={`${name}'s progress report`}
      footer={hasObservations ? (
        <PrimaryButton label="See lesson plan" onPress={() => router.push("/labs/onboarding-v2/week-reveal")} />
      ) : (
        <View style={{ gap: v2Space.sm }}>
          <TextLink label="Continue for now" onPress={() => router.push("/labs/onboarding-v2/account")} />
          <PrimaryButton label="Answer questions" onPress={() => router.push("/labs/onboarding-v2/ladder")} />
        </View>
      )}>
      <View style={{ gap: v2Space.md }}>
        <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
          {hasObservations
            ? `Based on what you've shared. Unanswered subjects can wait.`
            : `There aren't enough answers for a report yet. You can come back when you've seen more.`}
        </NativeText>
        {mappedSubjects.map((subject) => {
          const domain = MAP_SUBJECTS.find((entry) => entry.id === subject.subjectId);
          const locked = lockedIds.has(subject.subjectId);
          return (
            <View key={subject.subjectId} style={{ backgroundColor: v2Colors.paper,
              borderRadius: v2Radii.control, borderCurve: "continuous", borderWidth: 1,
              borderColor: v2Colors.border, padding: v2Space.md, gap: v2Space.sm }}>
              <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>{domain?.displayName}</NativeText>
              {locked ? (
                <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>Included with membership</NativeText>
              ) : (
                <>
                  {subject.strongestObservedStatement && subject.strongestObservedStatement !== subject.frontierStatement ? (
                    <NativeText style={[v2Type.caption, { color: v2Colors.ink }]}>
                      {`You've seen: ${subject.strongestObservedStatement}`}
                    </NativeText>
                  ) : null}
                  {subject.frontierStatement ? (
                    <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
                      {`A place to start: ${subject.frontierStatement}`}
                    </NativeText>
                  ) : null}
                </>
              )}
            </View>
          );
        })}
      </View>
    </OnboardingStage>
  );
}
