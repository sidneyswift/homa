import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Radii, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

/** Real production takes roughly 85 seconds (@homa/core scoring and
 * planning for real, materials-studio drawing the page for real). This lab
 * compresses that to a few seconds so iterating on the flow does not mean
 * waiting a minute and a half every pass; bump this one constant to feel
 * the real pace. */
const BUILDING_DURATION_MS = 6000;

const STAGES = [
  { end: 0.35, caption: "Reading through everything you told me" },
  { end: 0.7, caption: "Scoring where things stand right now" },
  { end: 1, caption: "Drawing Monday's page" },
] as const;

export default function BuildingScreen() {
  const router = useRouter();
  const { firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const fraction = Math.min(1, (Date.now() - start) / BUILDING_DURATION_MS);
      setElapsed(fraction);
      if (fraction >= 1) {
        clearInterval(id);
        router.replace("/labs/onboarding-v2/monday-page");
      }
    }, 60);
    return () => clearInterval(id);
  }, [router]);

  const stageIndex = STAGES.findIndex((s) => elapsed < s.end);
  const activeStage = stageIndex === -1 ? STAGES.length - 1 : stageIndex;

  return (
    <OnboardingStage
      posture="docked"
      characterState="thinking"
      progress={0.8 + 0.12 * elapsed}
      bubbleKey={`building-${activeStage}`}
      bubble={`Building ${name}'s week.`}
    >
      <View style={{ gap: v2Space.lg, paddingTop: v2Space.lg }}>
        {STAGES.map((stage, index) => {
          const start = index === 0 ? 0 : STAGES[index - 1].end;
          const fill = Math.max(0, Math.min(1, (elapsed - start) / (stage.end - start)));
          return (
            <View key={stage.caption} style={{ gap: v2Space.xs }}>
              <NativeText style={[v2Type.chip, { color: fill > 0 ? v2Colors.ink : v2Colors.inkMuted }]}>
                {stage.caption}
              </NativeText>
              <View
                style={{
                  height: 6,
                  borderRadius: v2Radii.pill,
                  backgroundColor: v2Colors.border,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${fill * 100}%`,
                    borderRadius: v2Radii.pill,
                    backgroundColor: v2Colors.coral,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </OnboardingStage>
  );
}
