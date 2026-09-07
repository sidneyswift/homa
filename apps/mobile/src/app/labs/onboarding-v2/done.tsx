import { useLocalSearchParams, useRouter } from "expo-router";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { TextLink } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";

export default function DoneScreen() {
  const router = useRouter();
  const { reset, firstChild } = useOnboardingV2();
  const { outcome } = useLocalSearchParams<{ outcome?: string }>();
  const name = firstChild?.name ?? "your kid";

  const bubble =
    outcome === "trial"
      ? `You're all set. I'll see you and ${name} tomorrow.`
      : "No pressure. Monday's page is still yours whenever you want it.";

  return (
    <OnboardingStage
      posture="big"
      characterState="speaking"
      bubbleKey="done"
      bubble={bubble}
      footer={
        <TextLink
          label="Start over"
          onPress={() => {
            reset();
            router.replace("/labs/onboarding-v2");
          }}
        />
      }
    />
  );
}
