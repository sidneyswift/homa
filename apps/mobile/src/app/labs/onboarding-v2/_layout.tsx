import { Stack, useRouter } from "expo-router";
import { Pressable } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingV2Provider, useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Radii, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

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
      <RestartLabButton />
    </OnboardingV2Provider>
  );
}

/**
 * The lab's own version of the real onboarding walk's floating restart
 * pill ((onboarding)/_layout.tsx's DevRestartWalk, dev-only there since it
 * touches a real family's server-side onboarding row). This lab has no
 * server state to reset, only in-memory context, so it can stay on
 * unconditionally: the whole route tree is already excluded from real
 * builds by mobile-production-bundle-check.mjs.
 */
function RestartLabButton() {
  const router = useRouter();
  const { reset } = useOnboardingV2();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Restart the onboarding v2 lab"
      onPress={() => {
        reset();
        router.replace("/labs/onboarding-v2");
      }}
      style={{
        position: "absolute",
        top: 100,
        left: v2Space.md,
        paddingHorizontal: v2Space.sm,
        paddingVertical: 4,
        borderRadius: v2Radii.pill,
        borderWidth: 1,
        borderColor: v2Colors.border,
        backgroundColor: v2Colors.paper,
        opacity: 0.85,
      }}
    >
      <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>↺ restart lab</NativeText>
    </Pressable>
  );
}
