import { useRouter } from "expo-router";
import { View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { CheckboxRow, PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type HardestNow } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

const OPTIONS: { value: HardestNow; label: string }[] = [
  { value: "schedule", label: "Keeping a schedule" },
  { value: "on-track", label: "Understanding my child's progress" },
  { value: "materials", label: "Finding lesson materials" },
  { value: "juggling", label: "Teaching more than one child" },
  { value: "little-one", label: "Keeping a younger child busy" },
  { value: "hours", label: "Tracking homeschool hours" },
];

// Keep the current single selection when Fast Refresh updates an open lab session.
function selectedPriorities(value: HardestNow[] | HardestNow | null): HardestNow[] {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return selected.includes("all-of-it") ? OPTIONS.map((option) => option.value) : selected;
}

export default function HelpPrioritiesScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  const selected = selectedPriorities(state.hardestNow);
  const allSelected = OPTIONS.every((option) => selected.includes(option.value));

  function toggle(value: HardestNow) {
    update("hardestNow", selected.includes(value)
      ? selected.filter((choice) => choice !== value)
      : [...selected, value]);
  }

  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()}
      progressLabel="Your homeschool" bubbleKey="hardest-now" bubble="What would you like help with?"
      footer={<PrimaryButton label="Continue" onPress={() => {
        update("hardestNow", selected);
        router.push("/labs/onboarding-v2/curriculum");
      }} disabled={selected.length === 0} />}
    >
      <View style={{ gap: v2Space.sm }}>
        <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>Choose all that apply.</NativeText>
        {OPTIONS.map((option) => (
          <CheckboxRow key={option.value}
            label={option.label} selected={selected.includes(option.value)} onPress={() => toggle(option.value)} />
        ))}
        <CheckboxRow label="Select all topics" selected={allSelected}
          onPress={() => update("hardestNow", allSelected ? [] : OPTIONS.map((option) => option.value))} />
      </View>
    </OnboardingStage>
  );
}
