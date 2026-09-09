import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors } from "../../../features/onboarding-v2/theme";

// A short preview transition in this local lab, not measured server progress.
const PREVIEW_DELAY_MS = 2000;

export default function BuildingScreen() {
  const router = useRouter();
  const { firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your child";

  useEffect(() => {
    const id = setTimeout(() => router.replace("/labs/onboarding-v2/first-page"), PREVIEW_DELAY_MS);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <OnboardingStage posture="docked" characterState="thinking" progressLabel="Lesson preview"
      bubbleKey="building" bubble={`Getting ${name}'s preview ready.`}>
      <ActivityIndicator accessibilityLabel="Preparing preview" size="large" color={v2Colors.coral} />
    </OnboardingStage>
  );
}
