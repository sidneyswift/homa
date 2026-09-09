import { useRouter } from "expo-router";
import { Keyboard, View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { CurriculumPicker } from "../../../features/onboarding-v2/CurriculumPicker";
import { PrimaryButton, TextLink } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2, type V2State } from "../../../features/onboarding-v2/state";
import { v2Space } from "../../../features/onboarding-v2/theme";

export default function CurriculumScreen() {
  const router = useRouter();
  const { state, update } = useOnboardingV2();
  const tags = state.curriculumTags;
  function goNext(status: NonNullable<V2State["curriculumStatus"]>) {
    if (status === "have-it" && tags.length === 0) return;
    update("curriculumStatus", status);
    update("curriculumTags", status === "have-it" ? tags : []);
    Keyboard.dismiss();
    router.push(state.kids.length > 1 ? "/labs/onboarding-v2/who-first" : "/labs/onboarding-v2/loving");
  }
  return (
    <OnboardingStage posture="docked" characterState="listening" onBack={() => router.back()}
      progressLabel="Your homeschool" bubbleKey="curriculum" bubble="Which curriculum are you using?"
      footer={
        <View style={{ gap: v2Space.sm }}>
          {tags.length === 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: v2Space.lg }}>
              <TextLink label="Still choosing" onPress={() => goNext("still-looking")} />
              <TextLink label="Making my own" onPress={() => goNext("building-own")} />
            </View>
          ) : null}
          <PrimaryButton label="Continue" onPress={() => goNext("have-it")} disabled={tags.length === 0} />
        </View>
      }
    >
      <CurriculumPicker selected={tags} onChange={(next) => update("curriculumTags", next)} />
    </OnboardingStage>
  );
}
