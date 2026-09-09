import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { RadioRow, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type HomeschoolStatus } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const OPTIONS: { value: HomeschoolStatus; label: string }[] = [
  { value: "already", label: "Already homeschooling" },
  { value: "starting", label: "Starting this year" },
  { value: "exploring", label: "Just exploring" },
];
export default function Screen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()}
      progressLabel="Your homeschool" bubbleKey="homeschool-status" bubble="Where are you with homeschooling?"
      footer={<PrimaryButton label="Continue" onPress={() => router.push("/labs/onboarding-v2/hardest-now")} disabled={state.homeschoolStatus === null} />}
    >
      <View style={{ gap: v2Space.sm }}>
        {OPTIONS.map((option) => (
          <RadioRow key={option.value}
            label={option.label} selected={state.homeschoolStatus === option.value} onPress={() => update("homeschoolStatus", option.value)} />
        ))}
      </View>
    </OnboardingStage>
  );
}
