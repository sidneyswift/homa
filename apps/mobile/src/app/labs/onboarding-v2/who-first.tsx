import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, ageInMonthsFromParts } from "../../../features/onboarding-v2/state";
import { NativeText } from "../../../components/ui/semantic";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

/** Only reached when there is more than one kid. Entry order, no default
 * highlight, no "why": the council review's edge-cases finding warns a
 * ranked or reasoned choice reads as comparing siblings. */
export default function WhoFirstScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.34}
      bubbleKey="who-first"
      bubble="Everyone gets a turn. Who's first?"
    >
      <View style={{ gap: v2Space.lg }}>
        <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
          {"I'll map one now, the others after."}
        </NativeText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>
          {state.kids.map((kid) => (
            <Chip
              key={kid.id}
              label={`${kid.name}, ${Math.floor(ageInMonthsFromParts(kid.birthMonth, kid.birthYear) / 12)}`}
              selected={state.firstChildId === kid.id}
              role="radio"
              onPress={() => update("firstChildId", kid.id)}
            />
          ))}
        </View>
        <PrimaryButton
          label="Continue"
          onPress={() => router.push("/labs/onboarding-v2/loving")}
          disabled={state.firstChildId === null}
        />
      </View>
    </OnboardingStage>
  );
}
