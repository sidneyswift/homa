import { Redirect, useRouter } from "expo-router";
import { Keyboard, View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { InterestPicker } from "../../../features/onboarding-v2/InterestPicker";
import { PrimaryButton, TextLink } from "../../../features/onboarding-v2/controls";
import { ageInMonthsFromParts, useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

export default function LovingScreen() {
  const router = useRouter();
  const { setChildInterests, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your child";
  const interests = firstChild?.interests ?? [];
  function goNext(skip = false) {
    if (!firstChild) return;
    if (skip) setChildInterests(firstChild.id, []);
    Keyboard.dismiss();
    router.push("/labs/onboarding-v2/subject");
  }
  if (!firstChild) return <Redirect href="/labs/onboarding-v2/first-child" />;
  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()}
      progressLabel={`${name}'s lessons`} bubbleKey="loving" bubble={`What does ${name} enjoy?`}
      footer={<View style={{ gap: v2Space.sm }}>
        {interests.length === 0 ? <TextLink label="Skip for now" onPress={() => goNext(true)} /> : null}
        <PrimaryButton label="Continue" onPress={() => goNext()} disabled={interests.length === 0} />
      </View>}
    >
      <InterestPicker key={firstChild.id} childName={name}
        ageMonths={ageInMonthsFromParts(firstChild.birthMonth, firstChild.birthYear)}
        selected={interests} onChange={(next) => setChildInterests(firstChild.id, next)} />
    </OnboardingStage>
  );
}
