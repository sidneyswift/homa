import { useRouter } from "expo-router";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";

/** The one-bubble breather before the questionnaire: sets expectations
 * (how many, what it buys) so the ladder that follows never feels like an
 * open-ended quiz. */
export default function FrameScreen() {
  const router = useRouter();
  const { firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";

  return (
    <OnboardingStage
      posture="docked"
      onBack={() => router.back()}
      progress={0.5}
      bubbleKey="frame"
      bubble={`Sixteen quick subjects, then ${name}'s report and the first week.`}
      footer={<PrimaryButton label="Let's go" onPress={() => router.push("/labs/onboarding-v2/ladder")} />}
    />
  );
}
