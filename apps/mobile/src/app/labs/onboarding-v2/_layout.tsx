import { Stack } from "expo-router";

import { OnboardingV2Provider } from "../../../features/onboarding-v2/state";

/**
 * Onboarding v2, a self-contained lab. No session check, no
 * OnboardingGate: v2.0 has no backend and no auth, so nothing here can
 * depend on being signed in. Push between phases (not replace), matching
 * a real walk a parent might back out of mid-question.
 */
export default function OnboardingV2Layout() {
  return (
    <OnboardingV2Provider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </OnboardingV2Provider>
  );
}
