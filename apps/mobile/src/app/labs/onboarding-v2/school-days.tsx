import { useRouter } from "expo-router";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type SchoolDay } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

const DAYS: { value: SchoolDay; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

export default function SchoolDaysScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();

  function toggle(day: SchoolDay) {
    const has = state.schoolDays.includes(day);
    const next = has ? state.schoolDays.filter((d) => d !== day) : [...state.schoolDays, day];
    update("schoolDays", next.sort((a, b) => a - b));
  }

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progressLabel="Your week"
      bubbleKey="school-days"
      bubble="Which days should I plan lessons for?"
      footer={<PrimaryButton label="Create my plan" onPress={() => router.push("/labs/onboarding-v2/building")} disabled={state.schoolDays.length === 0} />}
    >
      <View style={{ gap: v2Space.lg }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>
          {DAYS.map((day) => (
            <Chip
              key={day.value}
              label={day.label}
              selected={state.schoolDays.includes(day.value)}
              onPress={() => toggle(day.value)}
            />
          ))}
        </View>

      </View>
    </OnboardingStage>
  );
}
