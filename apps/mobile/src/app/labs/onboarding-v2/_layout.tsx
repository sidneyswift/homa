import { requireOptionalNativeModule } from "expo";
import { Stack } from "expo-router";
import { useEffect } from "react";

import { OnboardingV2Provider } from "../../../features/onboarding-v2/state";

/**
 * Onboarding v2, a self-contained lab. No session check, no
 * OnboardingGate: v2.0 has no backend and no auth, so nothing here can
 * depend on being signed in. Push between phases (not replace), matching
 * a real walk a parent might back out of mid-question.
 *
 * The restart-lab affordance lives in Stage.tsx itself, not floated here:
 * a fixed absolute position couldn't clear all three postures' varying
 * header heights (docked's back+progress row, plain's optional back link,
 * big's mascot starting right under the status bar) without colliding
 * with one of them.
 */
export default function OnboardingV2Layout() {
  useEffect(() => {
    if (!__DEV__) return;
    // Keep review screens clear; the simulator's keyboard shortcut still opens the dev menu.
    const preferences = requireOptionalNativeModule<{
      setPreferencesAsync: (value: { showFloatingActionButton: boolean }) => Promise<void>;
    }>("DevMenuPreferences");
    void preferences?.setPreferencesAsync({ showFloatingActionButton: false }).catch(() => {});
  }, []);

  return (
    <OnboardingV2Provider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </OnboardingV2Provider>
  );
}
