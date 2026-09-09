import { US_STATES } from "@homa/core";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Keyboard, ScrollView, View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { RadioRow, PrimaryButton, TextField, TextLink } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

export default function StatePickerScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => US_STATES.filter((s) => !query.trim()
    || s.name.toLowerCase().includes(query.trim().toLowerCase())
    || s.code.toLowerCase() === query.trim().toLowerCase()), [query]);
  function goNext() {
    Keyboard.dismiss();
    router.push("/labs/onboarding-v2/homeschool-status");
  }
  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()} scroll={false}
      progressLabel="Your homeschool" bubbleKey="state" bubble="Which state do you live in?"
      footer={<View style={{ gap: v2Space.sm }}>
        <TextLink label="I live outside the US" onPress={() => { update("usState", null); goNext(); }} />
        <PrimaryButton label="Continue" onPress={goNext} disabled={state.usState === null} />
      </View>}
    >
      <View style={{ flex: 1, gap: v2Space.md }}>
        <TextField value={query} onChangeText={setQuery} placeholder="Search states" accessibilityLabel="Search states" />
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
          contentContainerStyle={{ gap: v2Space.sm, paddingBottom: v2Space.md }}>
          {filtered.map((s) => (
            <RadioRow key={s.code} label={s.name} selected={state.usState === s.code}
              onPress={() => { update("usState", s.code); Keyboard.dismiss(); }} />
          ))}
          {filtered.length === 0 ? <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
            No states found. Try a name or abbreviation.
          </NativeText> : null}
        </ScrollView>
      </View>
    </OnboardingStage>
  );
}
