import { Redirect, Stack } from "expo-router";

import { useSession } from "../../features/auth/session-provider";
import { colors } from "../../theme/tokens";

/**
 * The native onboarding walk's shell (v1 plan 2026-08-18). Signed-in
 * only: the door itself lives in (auth)/signin. No headers; each beat
 * owns its whole screen.
 */
export default function OnboardingLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/signin" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.page },
      }}
    />
  );
}
