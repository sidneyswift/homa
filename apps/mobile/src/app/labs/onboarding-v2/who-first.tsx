import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { RadioRow, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, ageInMonthsFromParts } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

function ageLabel(months: number): string {
  const years = Math.floor(months / 12);
  return years === 0 ? `${months} month${months === 1 ? "" : "s"} old` : `${years} year${years === 1 ? "" : "s"} old`;
}

export default function Screen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()}
      progressLabel="Your children" bubbleKey="who-first" bubble="Which child should we plan for first?"
      footer={<PrimaryButton label="Continue" onPress={() => router.push("/labs/onboarding-v2/loving")} disabled={state.firstChildId === null} />}
    >
      <View style={{ gap: v2Space.sm }}>
        {state.kids.map((kid) => (
          <RadioRow key={kid.id}
            label={`${kid.name}, ${ageLabel(ageInMonthsFromParts(kid.birthMonth, kid.birthYear))}`} selected={state.firstChildId === kid.id} onPress={() => update("firstChildId", kid.id)} />
        ))}
      </View>
    </OnboardingStage>
  );
}
