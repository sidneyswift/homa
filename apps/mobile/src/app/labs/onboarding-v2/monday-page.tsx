import { MAP_SUBJECTS } from "@homa/core";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton } from "../../../features/onboarding-v2/controls";
import { MondayPage } from "../../../features/onboarding-v2/MondayPage";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";

export default function MondayPageScreen() {
  const router = useRouter();
  const { state, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";
  const subjectName = MAP_SUBJECTS.find((s) => s.id === state.startWithSubjectId)?.displayName ?? "Monday";

  return (
    <OnboardingStage
      posture="big"
      characterState="speaking"
      bubbleKey="monday-page"
      bubble={`Here's ${name}'s Monday. Ready before you close the app.`}
      footer={<PrimaryButton label="See the report" onPress={() => router.push("/labs/onboarding-v2/report")} />}
    >
      <View style={{ width: "100%" }}>
        <MondayPage childName={name} subjectName={subjectName} />
      </View>
    </OnboardingStage>
  );
}
