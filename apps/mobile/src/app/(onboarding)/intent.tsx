import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { NativeText } from "../../components/ui/semantic";
import { Button } from "../../components/ui/button";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  reportOnboardingStep,
  saveOnboardingState,
  type OnboardingIntent,
} from "../../features/onboarding/onboarding-state";
import { WalkScene } from "../../features/onboarding/walk-scene";
import { hapticAdvance, hapticTick } from "../../lib/haptics";
import { colors, palette, radius, space } from "../../theme/tokens";

/**
 * The one-tap intent ask (wireframe v4 step 3). "All of it" is the
 * expected winner and routes to worksheets first (the opinionated
 * default). Her pick goes straight to the kid questions: the react +
 * frame interstitial that used to sit here was cut as filler (founder
 * call 2026-08-23), which also retired the reaction-line fetch and the
 * "One moment" wait it caused on Continue.
 */
// Deck S2 (D10 approved 2026-08-31): parallel verb set, "for my kid"
// cut per Sidney.
const OPTIONS: { intent: OnboardingIntent; label: string }[] = [
  { intent: "worksheets", label: "Make a worksheet" },
  { intent: "plan", label: "Plan our week" },
  { intent: "hours", label: "Keep our hours" },
  { intent: "all", label: "Honestly, all of it" },
];

export default function IntentScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const [picked, setPicked] = useState<OnboardingIntent | null>(null);
  const [saving, setSaving] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "intent");
  }, [family]);

  async function continueWalk() {
    if (!family || !picked || saving) return;
    setSaving(true);
    await saveOnboardingState(family.id, "kids", { intent: picked });
    reportOnboardingStep(family.id, "kids", picked);
    setSaving(false);
    hapticAdvance();
    // Walk v2 order: the kids come right after the pick; the parent
    // screen (S7) follows them so the making screen can use her name.
    router.replace("/kids" as never);
  }

  return (
    <WalkScene>
      <View style={{ flex: 1, padding: space.lg, gap: space.md, justifyContent: "flex-start", paddingTop: space.xl }}>
        <NativeText role="display" tone="strong">
          What should we do first?
        </NativeText>
        <View style={{ gap: space.sm }}>
          {OPTIONS.map((option) => {
            const selected = picked === option.intent;
            return (
              <Pressable
                key={option.intent}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`intent.option.${option.intent}`}
                onPress={() => {
                  hapticTick();
                  setPicked(option.intent);
                }}
                style={{
                  minHeight: 52,
                  justifyContent: "center",
                  paddingHorizontal: space.md,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: selected ? palette.clay600 : colors.border,
                  backgroundColor: selected ? palette.clay600 : palette.clay50,
                }}
              >
                <NativeText role="body" tone={selected ? "inverse" : "strong"}>
                  {option.label}
                </NativeText>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: "auto", gap: space.sm }}>
          <Button
            label={saving ? "One moment…" : "Continue"}
            size="lg"
            onPress={() => void continueWalk()}
            disabled={!picked || saving || !family}
            busy={saving}
            testID="intent.continue"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.replace("/hello" as never)}
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
            testID="intent.back"
          >
            <NativeText role="control" tone="muted">
              Back
            </NativeText>
          </Pressable>
        </View>
      </View>
    </WalkScene>
  );
}
