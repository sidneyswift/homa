import { useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton, TextField } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

export default function YourFamilyScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  const [name, setName] = useState(state.parentName);
  const [lastName, setLastName] = useState(state.parentLastName);
  const canContinue = name.trim().length > 0 && lastName.trim().length > 0;

  function continueToChildren() {
    if (!canContinue) return;
    update("parentName", name.trim());
    update("parentLastName", lastName.trim());
    if (!state.familyName || state.familyName === state.parentLastName) {
      update("familyName", lastName.trim());
    }
    Keyboard.dismiss();
    router.push("/labs/onboarding-v2/first-child");
  }

  return (
    <OnboardingStage
      posture="docked"
      compact
      showLabControls={false}
      progressLabel="About you"
      characterState="listening"
      onBack={() => router.back()}
      bubbleTail="left"
      bubbleKey="your-family"
      bubble="Let's start with a little about you."
      footer={<PrimaryButton label="Continue" onPress={continueToChildren} disabled={!canContinue} />}
    >
      <View style={{ gap: v2Space.lg }}>
        <View style={{ gap: v2Space.sm }}>
          <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>Your first name</NativeText>
          <TextField value={name} onChangeText={setName} placeholder="e.g. Sarah" accessibilityLabel="Your first name" />
        </View>
        <View style={{ gap: v2Space.sm }}>
          <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>Your last name</NativeText>
          <TextField
            value={lastName}
            onChangeText={setLastName}
            placeholder="e.g. Smith"
            accessibilityLabel="Your last name"
            onSubmitEditing={continueToChildren}
          />
        </View>
      </View>
    </OnboardingStage>
  );
}
