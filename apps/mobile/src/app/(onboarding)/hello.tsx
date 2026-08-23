import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Button } from "../../components/ui/button";
import { NativeText } from "../../components/ui/semantic";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  reportOnboardingStep,
  saveOnboardingState,
} from "../../features/onboarding/onboarding-state";
import { WalkScene } from "../../features/onboarding/walk-scene";
import { getMyMemberDisplayName } from "../../lib/family";
import { space } from "../../theme/tokens";

/**
 * The GIVE beat right after the account moment (cadence law 8: celebrate
 * the heaviest ask immediately, briefly). Homa greets the parent BY NAME
 * when we have one, introduces herself, and explains the product once
 * in plain words before the first ask (founder direction 2026-08-21:
 * a no-context user needs the greeting personal, friendly, and the
 * product explained one more time). No auto-advance: she said hello,
 * the parent decides when to walk.
 */
export default function HelloScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const reported = useRef(false);
  const advanced = useRef(false);
  // undefined = still resolving (render nothing rather than swap text
  // mid-read; founder law 2026-08-18, the screen arrives whole).
  const [firstName, setFirstName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void getMyMemberDisplayName()
      .catch(() => null)
      .then((memberName) => {
        if (cancelled) return;
        const raw = memberName ?? family?.parent_display_name ?? null;
        setFirstName(raw ? raw.trim().split(/\s+/)[0] : null);
      });
    return () => {
      cancelled = true;
    };
  }, [family]);

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "hello");
    void saveOnboardingState(family.id, "hello", {});
  }, [family]);

  function advance() {
    if (advanced.current) return;
    advanced.current = true;
    router.replace("/intent" as never);
  }

  return (
    <WalkScene>
      <View
        style={{
          flex: 1,
          padding: space.lg,
          paddingTop: space.xl,
          gap: space.md,
        }}
      >
        {firstName !== undefined ? (
          <>
            <NativeText role="display" tone="strong" style={{ fontSize: 40, lineHeight: 46 }}>
              {firstName ? `Nice to meet you, ${firstName}.` : "Nice to meet you."}
            </NativeText>
            <NativeText role="bodyLarge" tone="body" style={{ maxWidth: "92%" }}>
              {"I'm Homa. I make worksheets for your kids, plan your weeks, keep your hours, and take the questions you'd usually google at 10pm. First, tell me a little about your family, so everything I make is customized for your kids."}
            </NativeText>
          </>
        ) : null}
        <View style={{ marginTop: "auto", gap: space.sm }}>
          <Button label="Let's go" size="lg" onPress={advance} />
          {/* No Back on the first beat, but the primary sits at the
              same height as on every screen that has one: a silent
              44pt placeholder keeps the walk's button rhythm steady. */}
          <View style={{ minHeight: 44 }} />
        </View>
      </View>
    </WalkScene>
  );
}
