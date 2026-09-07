import { MAP_SUBJECTS } from "@homa/core";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

/** Real subject ids from the same bank the ladder walks, so the choice
 * here is the same enum the questionnaire and Monday's page target
 * (the council review's item-id contract: never a keyword table). */
export default function SubjectScreen() {
  const router = useRouter();
  const { state, update, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.42}
      bubbleKey="subject"
      bubble={`Where should I start with ${name}?`}
    >
      <View style={{ gap: v2Space.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>
          {MAP_SUBJECTS.map((subject) => (
            <Chip
              key={subject.id}
              label={subject.displayName}
              selected={state.startWithSubjectId === subject.id}
              role="radio"
              onPress={() => update("startWithSubjectId", subject.id)}
            />
          ))}
        </View>
        <PrimaryButton
          label="Continue"
          onPress={() => router.push("/labs/onboarding-v2/lesson-length")}
          disabled={state.startWithSubjectId === null}
        />
      </View>
    </OnboardingStage>
  );
}
