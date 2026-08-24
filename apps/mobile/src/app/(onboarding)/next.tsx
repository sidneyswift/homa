import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { NativeText } from "../../components/ui/semantic";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  loadOnboardingAnswers,
  markOnboardingComplete,
  reportOnboardingCompleted,
  reportOnboardingStep,
  saveOnboardingStep,
} from "../../features/onboarding/onboarding-state";
import { WalkScene, WalkSpeech } from "../../features/onboarding/walk-scene";
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
  // The planner screen is only calendar views; building the plan itself
  // is a chat conversation (open_planner/edit_plan). Land her in chat
  // with the ask already in the box, not a blank grid with no way in.
  plan_week: "/chat?planIntent=week",
  look_around: "/",
};

export default function NextScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ printed?: string | string[] }>();
  const { family } = useFamilyData();
  const [choosing, setChoosing] = useState(false);
  const reported = useRef(false);
  // The reveal passes printed=1 when the page actually went to the
  // printer, so the bubble can speak to what just happened instead of
  // quipping past it (founder call 2026-08-24).
  const printed = (Array.isArray(params.printed) ? params.printed[0] : params.printed) === "1";

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "next");
    void saveOnboardingStep(family.id, "next").catch(() => {});
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
    <WalkScene>
      <View style={{ flex: 1, padding: space.lg, gap: space.md, paddingTop: space.xs }}>
        <WalkSpeech>
          <NativeText role="body" tone="strong">
            {printed
              ? "That page is printing right now. And the more I know your kids, the better every page gets."
              : "That one's getting grabbed. And the more I know your kids, the better every page gets."}
          </NativeText>
        </WalkSpeech>
        <NativeText role="display" tone="strong" style={{ marginTop: space.lg }}>
          {"What's next?"}
        </NativeText>
        <View style={{ gap: space.sm }}>
          {/* One confident door leads; the rest are quiet rows. Three
              identical ghost cards gave the final beat no momentum
              (gauntlet round 1, 2026-08-21). */}
          {DOORS.map((item, index) => (
            <Pressable
              key={item.door}
              accessibilityRole="button"
              disabled={choosing}
              onPress={() => void choose(item.door)}
              style={{
                minHeight: index === 0 ? 64 : 56,
                paddingTop: space.xs,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: index === 0 ? colors.action : colors.border,
                backgroundColor: index === 0 ? colors.action : colors.card,
                opacity: choosing ? 0.6 : 1,
              }}
            >
              <NativeText role="body" tone={index === 0 ? "inverse" : "strong"}>
                {item.label}
              </NativeText>
              <NativeText
                role="caption"
                tone={index === 0 ? "inverse" : "muted"}
                style={index === 0 ? { opacity: 0.92 } : undefined}
              >
                {item.detail}
              </NativeText>
            </Pressable>
          ))}
        </View>
        <View style={{ height: space.xl }} />
      </View>
    </WalkScene>
  );
}
