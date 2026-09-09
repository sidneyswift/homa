import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton, TextLink } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

export default function DoneScreen() {
  const router = useRouter();
  const { reset, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "Your child";

  return (
    <OnboardingStage posture="big" characterState="speaking" heroPaddingTop={160}
      bubbleKey="done" bubble={`${name}'s lesson preview is ready.`}
      footer={<View style={{ gap: v2Space.sm }}>
        <PrimaryButton label="Open lesson preview" onPress={() => router.push({ pathname: "/labs/onboarding-v2/first-page", params: { from: "done" } })} />
        <TextLink label="Start over" onPress={() => { reset(); router.replace("/labs/onboarding-v2"); }} />
      </View>} />
  );
}
