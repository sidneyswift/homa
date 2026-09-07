import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton, TextField } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

export default function AboutYouScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  const [name, setName] = useState(state.parentName);

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.1}
      bubbleKey="about-you"
      bubble="And you? What should I call you?"
    >
      <View style={{ gap: v2Space.lg }}>
        <TextField value={name} onChangeText={setName} placeholder="Your name" autoFocus returnKeyType="done" />
        <PrimaryButton
          label="Continue"
          onPress={() => {
            update("parentName", name.trim());
            router.push("/labs/onboarding-v2/relationship");
          }}
          disabled={name.trim().length === 0}
        />
      </View>
    </OnboardingStage>
  );
}
