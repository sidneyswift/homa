import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type Relationship } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const OPTIONS: Relationship[] = ["Mom", "Dad", "Grandparent", "Someone else"];

export default function RelationshipScreen() {
  const router = useRouter();
  const { state, update, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.14}
      bubbleKey="relationship"
      bubble={`And you're ${name}'s...`}
    >
      <View style={{ gap: v2Space.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>
          {OPTIONS.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={state.relationship === option}
              role="radio"
              onPress={() => update("relationship", option)}
            />
          ))}
        </View>
        <PrimaryButton
          label="Continue"
          onPress={() => router.push("/labs/onboarding-v2/state-picker")}
          disabled={state.relationship === null}
        />
      </View>
    </OnboardingStage>
  );
}
