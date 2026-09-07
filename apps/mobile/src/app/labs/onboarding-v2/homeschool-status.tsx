import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type HomeschoolStatus } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const OPTIONS: { value: HomeschoolStatus; label: string }[] = [
  { value: "already", label: "Already homeschooling" },
  { value: "starting", label: "Starting this year" },
  { value: "exploring", label: "Just exploring" },
];

export default function HomeschoolStatusScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.22}
      bubbleKey="homeschool-status"
      bubble="Homeschooling already, or getting started?"
    >
      <View style={{ gap: v2Space.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>
          {OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={state.homeschoolStatus === option.value}
              role="radio"
              onPress={() => update("homeschoolStatus", option.value)}
            />
          ))}
        </View>
        <PrimaryButton
          label="Continue"
          onPress={() => router.push("/labs/onboarding-v2/hardest-now")}
          disabled={state.homeschoolStatus === null}
        />
      </View>
    </OnboardingStage>
  );
}
