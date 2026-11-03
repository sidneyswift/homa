import { Redirect, Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { AiConsentGate } from "../../components/ai-consent-gate";
import { NativeText } from "../../components/ui/semantic";
import { useSession } from "../../features/auth/session-provider";
import { useFamilyData } from "../../features/family/use-family-data";
import { resetOnboardingWalk } from "../../features/onboarding/onboarding-state";
import { WalkCharacterProvider } from "../../features/onboarding/walk-character";
import { WalkStage } from "../../features/onboarding/walk-scene";
import { colors, radius, space } from "../../theme/app2";

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
    <AiConsentGate purpose="onboarding">
    <View style={{ flex: 1 }}>
      <WalkCharacterProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            // animationTypeForReplace defaults to "pop" (confirmed in
            // expo-router's own installed types), which ignores
            // animation/animationDuration entirely. Every walk screen
            // navigates with router.replace (never push), so without
            // this the configured fade never actually ran, caught
            // 2026-09-02 only by testing an absurd animationDuration
            // and seeing zero visual difference.
            animationTypeForReplace: "push",
            // React Navigation's native-stack default is 350ms (iOS
            // only; unsupported params are no-ops elsewhere). A plain
            // opacity crossfade on text/buttons reads as sluggish at
            // that length even though the persistent mascot/sky (see
            // walk-scene.tsx) eases over the same 350ms and looks fine,
            // a combined scale+color motion just carries a slower pace
            // better than a flat fade does. Founder catch 2026-09-02.
            animationDuration: 200,
            contentStyle: { backgroundColor: colors.page },
          }}
        />
        {/* The stage is mounted once, floated over the navigator:
            Homa and her sky persist while screens fade beneath her
            (founder ruling 2026-08-21: she stays). Pointer-transparent. */}
        <WalkStage />
        {__DEV__ ? <DevRestartWalk /> : null}
      </WalkCharacterProvider>
    </View>
    </AiConsentGate>
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
    // hello.tsx is gone (merged into sign-in, 2026-09-03); kids is the
    // walk's real first screen now. resetOnboardingWalk still writes
    // step:"hello" to the DB, which is fine, onboarding-gate.tsx's own
    // STEP_ROUTES resolves that symbolic value to /kids too.
    router.replace("/kids" as never);
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
