import { US_STATES } from "@homa/core";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton, TextField, TextLink } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

/**
 * "Which state?" A searchable list, not the full US_STATES scroll the
 * production you.tsx uses today (the council review's native-ux finding:
 * that picker has no search). State-specific regulation facts are a
 * server-only slot (state_requirements) this lab cannot query, so unlike
 * production's StateCard this screen gives an honest, non-specific
 * reassurance rather than fabricating a claim about any one state's
 * actual homeschool law.
 */
export default function StatePickerScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      US_STATES.filter(
        (s) =>
          query.trim().length === 0 ||
          s.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          s.code.toLowerCase() === query.trim().toLowerCase(),
      ),
    [query],
  );
  const selectedName = US_STATES.find((s) => s.code === state.usState)?.name;

  function goNext() {
    router.push("/labs/onboarding-v2/homeschool-status");
  }

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.18}
      bubbleKey={state.usState ? "state-fact" : "state-ask"}
      bubble={
        state.usState
          ? `${selectedName}. Every state's homeschool rules are different, and I'll keep yours straight.`
          : "Which state? Each one has its own homeschool rules and I'll keep yours straight."
      }
    >
      {state.usState ? (
        <View style={{ gap: v2Space.lg }}>
          <TextLink label="Change state" onPress={() => update("usState", null)} />
          <PrimaryButton label="Continue" onPress={goNext} />
        </View>
      ) : (
        <View style={{ gap: v2Space.md, flex: 1 }}>
          <TextField value={query} onChangeText={setQuery} placeholder="Search your state" />
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: v2Space.sm }}>
            {filtered.map((s) => (
              <Chip key={s.code} label={s.name} selected={false} role="radio" onPress={() => update("usState", s.code)} />
            ))}
          </ScrollView>
          <TextLink
            label="I'm outside the US"
            onPress={() => {
              update("usState", null);
              goNext();
            }}
          />
        </View>
      )}
    </OnboardingStage>
  );
}
