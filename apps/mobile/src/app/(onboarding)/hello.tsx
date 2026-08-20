import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { NativeText } from "../../components/ui/semantic";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  reportOnboardingStep,
  saveOnboardingState,
} from "../../features/onboarding/onboarding-state";
import { colors, space } from "../../theme/tokens";

/**
 * The GIVE beat right after the account moment (cadence law 8: celebrate
 * the heaviest ask immediately, briefly). Homa says hello in her own
 * voice, then the screen moves itself; a visible Continue exists for
 * anyone who has auto-advance animations reduced or simply wants to go.
 */
const AUTO_ADVANCE_MS = 3_500;

export default function HelloScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const reported = useRef(false);
  const advanced = useRef(false);

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "hello");
    void saveOnboardingState(family.id, "hello", {});
  }, [family]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      timer = setTimeout(() => advance(), AUTO_ADVANCE_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function advance() {
    if (advanced.current) return;
    advanced.current = true;
    router.replace("/intent" as never);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: space.lg,
          gap: space.lg,
        }}
      >
        <View style={{ alignItems: "center", gap: space.md }}>
          <Logo size={56} />
          <NativeText
            role="display"
            tone="strong"
            style={{ textAlign: "center" }}
          >
            {"You're in."}
          </NativeText>
          <NativeText role="body" tone="body" style={{ textAlign: "center" }}>
            {"Hi, I'm Homa. I help homeschool families like yours every day. Let's make something your kids will grab out of your hands."}
          </NativeText>
        </View>
        <Button label="Let's go" size="lg" onPress={advance} />
      </View>
    </SafeAreaView>
  );
}
