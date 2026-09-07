import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton, TagInput } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const STARTING_OPTIONS: { value: "have-it" | "still-looking" | "building-own"; label: string }[] = [
  { value: "have-it", label: "Yes, let me type it" },
  { value: "still-looking", label: "Still looking" },
  { value: "building-own", label: "Building my own" },
];

/**
 * Branches by homeschool status, per the council review: already-
 * homeschooling gets the real curriculum tag input (no atlas lookup here,
 * that is a server-only slot); starting or exploring gets a lighter
 * chip question instead of implying she already has one picked.
 */
export default function CurriculumScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  const already = state.homeschoolStatus === "already";

  function goNext() {
    router.push(state.kids.length > 1 ? "/labs/onboarding-v2/who-first" : "/labs/onboarding-v2/loving");
  }

  if (already) {
    return (
      <OnboardingStage
        posture="docked"
        characterState="listening"
        onBack={() => router.back()}
        progress={0.3}
        bubbleKey="curriculum-tags"
        bubble="Curriculums you're using?"
      >
        <View style={{ gap: v2Space.lg }}>
          <TagInput
            tags={state.curriculumTags}
            onChange={(tags) => update("curriculumTags", tags)}
            placeholder="Math-U-See, The Good and the Beautiful..."
          />
          <PrimaryButton label="Continue" onPress={goNext} />
        </View>
      </OnboardingStage>
    );
  }

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.3}
      bubbleKey="curriculum-status"
      bubble="Have you picked a curriculum yet?"
    >
      <View style={{ gap: v2Space.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>
          {STARTING_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={state.curriculumStatus === option.value}
              role="radio"
              onPress={() => update("curriculumStatus", option.value)}
            />
          ))}
        </View>
        <PrimaryButton label="Continue" onPress={goNext} disabled={state.curriculumStatus === null} />
      </View>
    </OnboardingStage>
  );
}
