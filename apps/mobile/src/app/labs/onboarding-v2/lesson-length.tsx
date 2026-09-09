import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { RadioRow, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type LessonMinutes } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const OPTIONS: LessonMinutes[] = [10, 20, 30, 45];
export default function Screen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()}
      progressLabel="Lesson length" bubbleKey="lesson-length" bubble="How long should each lesson be?"
      footer={<PrimaryButton label="Continue" onPress={() => router.push("/labs/onboarding-v2/frame")} disabled={state.lessonMinutes === null} />}
    >
      <View style={{ gap: v2Space.sm }}>
        {OPTIONS.map((minutes) => (
          <RadioRow key={minutes}
            label={`${minutes} minutes`} selected={state.lessonMinutes === minutes} onPress={() => update("lessonMinutes", minutes)} />
        ))}
      </View>
    </OnboardingStage>
  );
}
