import { Redirect, Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { NativeText } from "../../components/ui/semantic";
import { useSession } from "../../features/auth/session-provider";
import { useFamilyData } from "../../features/family/use-family-data";
import { resetOnboardingWalk } from "../../features/onboarding/onboarding-state";
import { colors, radius, space } from "../../theme/tokens";

/**
 * The native onboarding walk's shell (v1 plan 2026-08-18). Signed-in
 * only: the door itself lives in (auth)/signin. No headers; each beat
 * owns its whole screen. Dev builds get a floating restart control so
 * the walk can be replayed while iterating (founder ask 2026-08-18);
 * it does not exist in release builds.
 */
export default function OnboardingLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/signin" />;

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.page },
        }}
      />
      {__DEV__ ? <DevRestartWalk /> : null}
    </View>
  );
}

function DevRestartWalk() {
  const router = useRouter();
  const { family } = useFamilyData();
  const [busy, setBusy] = useState(false);

  async function restart() {
    if (!family || busy) return;
    setBusy(true);
    await resetOnboardingWalk(family.id);
    setBusy(false);
    router.replace("/hello" as never);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Restart onboarding walk (dev only)"
      onPress={() => void restart()}
      style={{
        position: "absolute",
        top: 64,
        left: space.md,
        paddingHorizontal: space.sm,
        paddingVertical: 4,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        opacity: busy ? 0.5 : 0.75,
      }}
    >
      <NativeText role="caption" tone="muted">
        {busy ? "resetting…" : "↺ dev: restart walk"}
      </NativeText>
    </Pressable>
  );
}
