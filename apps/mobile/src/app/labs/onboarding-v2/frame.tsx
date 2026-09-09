import { MAP_SUBJECTS, REPORT_LOCK_FREE_COUNT } from "@homa/core";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton } from "../../../features/onboarding-v2/controls";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

export default function FrameScreen() {
  const router = useRouter();
  const { firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your child";
  return (
    <OnboardingStage posture="docked" onBack={() => router.back()} progressLabel={`${name}'s progress`}
      bubbleKey="frame" bubble={`Tell me what ${name} can do.`}
      footer={<PrimaryButton label="Start questions" onPress={() => router.push("/labs/onboarding-v2/ladder")} />}
    >
      <View style={{ gap: v2Space.md }}>
        <NativeText style={[v2Type.caption, { color: v2Colors.ink }]}>
          {`Up to ${MAP_SUBJECTS.length} subjects, with follow-up questions based on your answers. You can finish early.`}
        </NativeText>
        <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
          {"Choose “Not sure” when you haven't seen the skill yet."}
        </NativeText>
        <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
          {`Your free report includes up to ${REPORT_LOCK_FREE_COUNT} subjects. More subjects are included with membership.`}
        </NativeText>
      </View>
    </OnboardingStage>
  );
}
