import { MAP_SUBJECTS } from "@homa/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton } from "../../../features/onboarding-v2/controls";
import { FirstPage } from "../../../features/onboarding-v2/FirstPage";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";

export default function FirstPageScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { state, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your child";
  const subjectName = MAP_SUBJECTS.find((s) => s.id === state.startWithSubjectId)?.displayName ?? "Math";

  return (
    <OnboardingStage
      posture="docked"
      progressLabel="Lesson preview"
      onBack={() => router.back()}
      characterState="speaking"
      bubbleKey="first-page"
      bubble={`A first lesson for ${name}.`}
      footer={<PrimaryButton label={from === "done" ? "Close preview" : "See progress report"}
        onPress={() => from === "done" ? router.back() : router.push("/labs/onboarding-v2/report")} />}
    >
      <View style={{ width: "100%" }}>
        <FirstPage subjectName={subjectName} />
      </View>
    </OnboardingStage>
  );
}
