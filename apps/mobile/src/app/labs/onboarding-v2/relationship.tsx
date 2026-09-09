import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { RadioRow, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type Relationship } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const OPTIONS: Relationship[] = ["Mom", "Dad", "Grandparent", "Someone else"];
export default function Screen() {
  const router = useRouter();
  const { state, update, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your child";
  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()}
      progressLabel="About you" bubbleKey="relationship" bubble={`What's your relationship to ${name}?`}
      footer={<PrimaryButton label="Continue" onPress={() => router.push("/labs/onboarding-v2/state-picker")} disabled={state.relationship === null} />}
    >
      <View style={{ gap: v2Space.sm }}>
        {OPTIONS.map((option) => (
          <RadioRow key={option}
            label={option} selected={state.relationship === option} onPress={() => update("relationship", option)} />
        ))}
      </View>
    </OnboardingStage>
  );
}
