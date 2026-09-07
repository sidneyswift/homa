import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton, TagInput } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

export default function LovingScreen() {
  const router = useRouter();
  const { state, update, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.38}
      bubbleKey="loving"
      bubble={`What's ${name} loving right now?`}
    >
      <View style={{ gap: v2Space.lg }}>
        <TagInput
          tags={state.loving}
          onChange={(tags) => update("loving", tags)}
          placeholder="Dinosaurs, space, drawing..."
        />
        <PrimaryButton label="Continue" onPress={() => router.push("/labs/onboarding-v2/subject")} disabled={state.loving.length === 0} />
      </View>
    </OnboardingStage>
  );
}
