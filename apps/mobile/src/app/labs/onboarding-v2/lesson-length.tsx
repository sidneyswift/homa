import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type LessonMinutes } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const OPTIONS: LessonMinutes[] = [10, 20, 30, 45];

export default function LessonLengthScreen() {
  const router = useRouter();
  const { state, update, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.46}
      bubbleKey="lesson-length"
      bubble={`About how long can ${name} sit for a lesson?`}
    >
      <View style={{ gap: v2Space.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>
          {OPTIONS.map((minutes) => (
            <Chip
              key={minutes}
              label={`${minutes} min`}
              selected={state.lessonMinutes === minutes}
              role="radio"
              onPress={() => update("lessonMinutes", minutes)}
            />
          ))}
        </View>
        <PrimaryButton
          label="Continue"
          onPress={() => router.push("/labs/onboarding-v2/frame")}
          disabled={state.lessonMinutes === null}
        />
      </View>
    </OnboardingStage>
  );
}
