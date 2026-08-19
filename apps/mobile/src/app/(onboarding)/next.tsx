import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "../../components/ui/card";
import { NativeText } from "../../components/ui/semantic";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  loadOnboardingAnswers,
  markOnboardingComplete,
  reportOnboardingCompleted,
  reportOnboardingStep,
  saveOnboardingState,
} from "../../features/onboarding/onboarding-state";
import { colors, radius, space } from "../../theme/tokens";

/**
 * What's next (wireframe v4 step 6, GIVE then ASK): the honest line
 * lands right after the wow, then three doors. Every door completes the
 * walk; the completed funnel event carries the shape of the family and
 * which door she chose. The second-create tap is the paywall trigger's
 * instrumentation (D4: the wall itself stays dark until ruled).
 */
type Door = "another_worksheet" | "plan_week" | "look_around";

const DOORS: { door: Door; label: string; detail: string }[] = [
  {
    door: "another_worksheet",
    label: "Another worksheet",
    detail: "For a sibling, or tomorrow's page",
  },
  { door: "plan_week", label: "Plan our week", detail: "Homa builds it with you" },
  { door: "look_around", label: "Just look around", detail: "The whole app is yours" },
];

const DOOR_ROUTES: Record<Door, string> = {
  another_worksheet: "/binder",
  plan_week: "/planner",
  look_around: "/",
};

export default function NextScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const [choosing, setChoosing] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "next");
    void saveOnboardingState(family.id, "next", {}).catch(() => {});
  }, [family]);

  async function choose(door: Door) {
    if (!family || choosing) return;
    setChoosing(true);
    const answers = await loadOnboardingAnswers(family.id).catch(() => null);
    reportOnboardingCompleted(family.id, {
      kids_added: answers?.kids?.filter((kid) => kid.name.trim()).length ?? 0,
      intent: answers?.intent ?? "all",
      next_door: door,
      second_create_tapped: door === "another_worksheet",
    });
    await markOnboardingComplete(family.id);
    router.replace(DOOR_ROUTES[door] as never);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ flex: 1, padding: space.lg, gap: space.md, justifyContent: "center" }}>
        <Card>
          <NativeText role="bodyLarge" tone="strong">
            {"That's going to get grabbed. And here's the thing: the more I know your kids, the better these get."}
          </NativeText>
        </Card>
        <NativeText role="display" tone="strong">
          {"What's next?"}
        </NativeText>
        <View style={{ gap: space.sm }}>
          {DOORS.map((item) => (
            <Pressable
              key={item.door}
              accessibilityRole="button"
              disabled={choosing}
              onPress={() => void choose(item.door)}
              style={{
                minHeight: 60,
                justifyContent: "center",
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: choosing ? 0.6 : 1,
              }}
            >
              <NativeText role="body" tone="strong">
                {item.label}
              </NativeText>
              <NativeText role="caption" tone="muted">
                {item.detail}
              </NativeText>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
