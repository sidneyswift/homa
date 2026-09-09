import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { RadioRow, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { MAP_SUBJECTS } from "@homa/core";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";


export default function Screen() {
  const router = useRouter();
  const { state, update, firstChild } = useOnboardingV2();
  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()}
      progressLabel={`${firstChild?.name ?? "Your child"}'s lessons`} bubbleKey="subject" bubble="Which subject should we start with?"
      footer={<PrimaryButton label="Continue" onPress={() => router.push("/labs/onboarding-v2/lesson-length")} disabled={state.startWithSubjectId === null} />}
    >
      <View style={{ gap: v2Space.sm }}>
        {MAP_SUBJECTS.map((subject) => (
          <RadioRow key={subject.id}
            label={subject.displayName} selected={state.startWithSubjectId === subject.id} onPress={() => update("startWithSubjectId", subject.id)} />
        ))}
      </View>
    </OnboardingStage>
  );
}
