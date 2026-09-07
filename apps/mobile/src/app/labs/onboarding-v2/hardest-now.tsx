import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type HardestNow } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const OPTIONS: { value: HardestNow; label: string; reaction: string }[] = [
  { value: "schedule", label: "Keeping a schedule", reaction: "I'll put the week on your calendar before you're done." },
  { value: "on-track", label: "Knowing if they're on track", reaction: "That's the report's whole job: where they are right now, and what comes next." },
  { value: "materials", label: "Finding materials", reaction: "Then Monday's page comes first." },
  { value: "juggling", label: "Juggling more than one kid at once", reaction: "Then the week will have a shared block first." },
  { value: "little-one", label: "Keeping the little one busy while I teach", reaction: "A page for the little one while you teach, then." },
  { value: "hours", label: "Keeping track of hours", reaction: "I'll keep the hours you teach in one place." },
  { value: "all-of-it", label: "All of it, honestly", reaction: "Fair. Let's start with one kid and one week." },
];

export default function HardestNowScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  const [pressed, setPressed] = useState(false);
  const chosen = OPTIONS.find((o) => o.value === state.hardestNow) ?? null;

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.26}
      bubbleKey={pressed && chosen ? `hardest-reaction-${chosen.value}` : "hardest-now"}
      bubble={pressed && chosen ? chosen.reaction : "What's hardest right now?"}
    >
      <View style={{ gap: v2Space.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>
          {OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={state.hardestNow === option.value}
              role="radio"
              onPress={() => {
                update("hardestNow", option.value);
                setPressed(true);
              }}
            />
          ))}
        </View>
        <PrimaryButton
          label="Continue"
          onPress={() => router.push("/labs/onboarding-v2/curriculum")}
          disabled={state.hardestNow === null}
        />
      </View>
    </OnboardingStage>
  );
}
