import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton } from "../../../features/onboarding-v2/controls";
import { v2Colors, v2Space, v2Type } from "../../../features/onboarding-v2/theme";
import { NativeText } from "../../../components/ui/semantic";

/**
 * Hello. Homa alone, big, centered, no chrome, three bubbles advancing on
 * tap, then the one shrink-and-dock moment. Styled like Headspace's own
 * welcome screen per the founder's 2026-09-07 direction: two clear doors,
 * not a single Continue plus a buried link, since a returning mother
 * should never have to redo fifteen minutes of answers to find her way
 * back to a real account she already has.
 */
const BUBBLES = [
  "Hi, I'm Homa.",
  "Tell me about your family. I'll plan the week and draw Monday's page.",
  "You'll see what your kid can do right now, and exactly where to start Monday.",
];

export default function HelloScreen() {
  const router = useRouter();
  const [bubbleIndex, setBubbleIndex] = useState(0);
  const atLastBubble = bubbleIndex === BUBBLES.length - 1;

  return (
    <OnboardingStage
      posture="big"
      characterState="speaking"
      heroPaddingTop={160}
      entrance
      gesture={bubbleIndex === 0 ? "wave" : null}
      bubbleKey={`hello-${bubbleIndex}`}
      bubble={BUBBLES[bubbleIndex]}
      scroll={false}
      footer={
        atLastBubble ? (
          <View style={{ gap: v2Space.sm }}>
            <View style={{ flexDirection: "row", gap: v2Space.sm }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="I'm new here" onPress={() => router.push("/labs/onboarding-v2/first-child")} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Sign in" onPress={() => router.push("/signin")} />
              </View>
            </View>
          </View>
        ) : (
          <PrimaryButton label="Continue" onPress={() => setBubbleIndex((i) => i + 1)} />
        )
      }
    >
      <NativeText
        onPress={!atLastBubble ? () => setBubbleIndex((i) => i + 1) : undefined}
        style={[v2Type.caption, { color: v2Colors.inkMuted, textAlign: "center" }]}
      >
        {!atLastBubble ? "Tap Continue when you're ready." : ""}
      </NativeText>
    </OnboardingStage>
  );
}
