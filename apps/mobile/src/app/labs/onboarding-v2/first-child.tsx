import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { Chip, PrimaryButton, TextField } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";
import { NativeText } from "../../../components/ui/semantic";
import { LegalLine } from "../../../features/auth/legal-line";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const CAP = 5;

/**
 * "Who's learning at home?" First question of the walk, per the council
 * review's reordered Section 3 (a child exists by bubble three, not
 * bubble ten). This add is the trust moment: in the real v2.1 build it is
 * where the anonymous account is minted and AI-processing consent is
 * recorded (an affirmative tap in Homa's voice, not a checkbox screen).
 * This lab has no backend, so LegalLine renders here as the honest
 * preview of that moment without a real consent write behind it.
 */
export default function FirstChildScreen() {
  const router = useRouter();
  const { state, addKid } = useOnboardingV2();
  const [name, setName] = useState("");
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 18 }, (_, i) => currentYear - i), [currentYear]);
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);

  const canAdd = name.trim().length > 0 && month !== null && year !== null;
  const canContinue = state.kids.length > 0;

  function addAndClear() {
    if (!canAdd || month === null || year === null) return;
    addKid({ name: name.trim(), birthMonth: month, birthYear: year });
    setName("");
    setMonth(null);
    setYear(null);
  }

  return (
    <OnboardingStage
      posture="docked"
      characterState="listening"
      onBack={() => router.back()}
      progress={0.05}
      bubbleKey="first-child"
      bubble="Who's learning at home?"
    >
      <View style={{ gap: v2Space.lg }}>
        {state.kids.length > 0 ? (
          <View style={{ gap: v2Space.sm }}>
            {state.kids.map((kid) => (
              <View
                key={kid.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: v2Colors.paper,
                  borderRadius: v2Space.sm,
                  borderWidth: 1,
                  borderColor: v2Colors.border,
                  paddingHorizontal: v2Space.md,
                  paddingVertical: v2Space.sm,
                }}
              >
                <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>{kid.name}</NativeText>
                <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
                  {MONTHS[kid.birthMonth - 1]} {kid.birthYear}
                </NativeText>
              </View>
            ))}
          </View>
        ) : null}

        {state.kids.length < CAP ? (
          <View style={{ gap: v2Space.md }}>
            <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
              First name is enough. It goes on their worksheet.
            </NativeText>
            <TextField value={name} onChangeText={setName} placeholder="Your child's name, e.g. Maya" />

            <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>Birth month and year</NativeText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: v2Space.sm }}>
              {MONTHS.map((label, index) => (
                <Chip key={label} label={label} selected={month === index + 1} onPress={() => setMonth(index + 1)} role="radio" />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: v2Space.sm }}>
              {years.map((y) => (
                <Chip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} role="radio" />
              ))}
            </ScrollView>

            <PrimaryButton label="Add" onPress={addAndClear} disabled={!canAdd} />
            <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted, textAlign: "center" }]}>
              Up to five, and you can add more later.
            </NativeText>
          </View>
        ) : null}

        <LegalLine />

        <PrimaryButton
          label="That's everyone"
          onPress={() => router.push("/labs/onboarding-v2/about-you")}
          disabled={!canContinue}
        />
      </View>
    </OnboardingStage>
  );
}
