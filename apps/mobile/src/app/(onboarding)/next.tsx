import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

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
import { hapticAdvance } from "../../lib/haptics";
import { colors, radius, space } from "../../theme/app2";

/**
 * S12, the doors (walk v2): reached after the paywall says yes, or
 * through the decline path's still-free branch. One honest line, then
 * three doors; every door completes the walk, and the completed funnel
 * event carries the shape of the family and which door she chose.
 * Copy is the founder-approved deck (copy-deck.md §S12): the D7
 * vocabulary law makes this screen say "page", never "worksheet",
 * because her page exists by now.
 */
type Door = "another_worksheet" | "see_report" | "log_lesson" | "plan_week" | "look_around";

/**
 * Report and lesson-log doors (founder direction 2026-11-04: onboarding
 * teaches progress reports and lesson logging, not only pages). Each one
 * lands on the real surface: Progress for the report the check-in
 * starts, and chat with the log sentence begun, because logging is
 * telling Homa.
 */
function doorsFor(kid: string | null): { door: Door; label: string; detail: string }[] {
  return [
    {
      door: "another_worksheet",
      label: "Make another page",
      detail: "For a sibling, or tomorrow morning",
    },
    {
      door: "see_report",
      label: kid ? `See ${kid}'s progress report` : "See the progress report",
      detail: kid
        ? `Where ${kid} is in each subject, and what to try next`
        : "Where your kid is in each subject, and what to try next",
    },
    {
      door: "log_lesson",
      label: "Log today's lesson",
      detail: "Tell me what you did. I keep the record",
    },
    { door: "plan_week", label: "Plan our week", detail: "Homa builds it with you" },
    // Not "the whole app is yours": onboarding-completion-milestones
    // (2026-07-31, apps/web/lib/onboarding/state.ts) already ends the
    // free window the moment the questionnaire scores its first report,
    // often before she ever reaches this screen. This door's copy must
    // never promise an access state the wall isn't actually granting.
    { door: "look_around", label: "Just look around", detail: "Peek in, no pressure" },
  ];
}

const DOOR_ROUTES: Record<Door, string> = {
  another_worksheet: "/binder",
  // Opened on the walk's child (see choose()), not the family's first.
  see_report: "/progress",
  log_lesson: "/chat?logIntent=lesson",
  // The planner screen is only calendar views; building the plan itself
  // is a chat conversation (open_planner/edit_plan). Land her in chat
  // with the ask already in the box, not a blank grid with no way in.
  plan_week: "/chat?planIntent=week",
  look_around: "/",
};

export default function NextScreen() {
  const router = useRouter();
  const { family, memberDisplayName } = useFamilyData();
  const [choosing, setChoosing] = useState(false);
  const [kidName, setKidName] = useState<string | null>(null);
  const [kidChildId, setKidChildId] = useState<string | null>(null);
  const reported = useRef(false);
  // DELTA change 4 (ruled 2026-08-31): the parent's name lands at a
  // peak. First name only; a family with no stored name simply gets the
  // sentence without the address, never a guessed one. The walk saves it
  // on the family record, so that counts too (see making.tsx).
  const parentFirstName =
    (memberDisplayName || family?.parent_display_name)?.trim().split(/\s+/u)[0] || null;

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "next");
    void saveOnboardingStep(family.id, "next").catch(() => {});
    void loadOnboardingAnswers(family.id)
      .then((answers) => {
        setKidName(answers?.kids?.[0]?.name.trim() || null);
        setKidChildId(answers?.kids?.[0]?.childId ?? null);
      })
      .catch(() => {});
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
    hapticAdvance();
    const route =
      door === "see_report" && kidChildId
        ? `${DOOR_ROUTES[door]}?childId=${encodeURIComponent(kidChildId)}`
        : DOOR_ROUTES[door];
    router.replace(route as never);
  }

  return (
    <WalkScene>
      {/* Five doors fill App Review's 375 by 667 iPad compatibility
          window exactly; one more wrapped line pushed the last door off
          a screen that could not scroll (Apple 2.1, 2026-09-09). */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: space.lg, gap: space.md, paddingTop: space.xs }}
      >
        <WalkSpeech>
          <NativeText role="body" tone="strong">
            {parentFirstName
              ? `The more I know your kids, ${parentFirstName}, the better every page gets.`
              : "The more I know your kids, the better every page gets."}
          </NativeText>
        </WalkSpeech>
        <NativeText role="display" tone="strong" style={{ marginTop: space.lg }}>
          {"What's next?"}
        </NativeText>
        <View style={{ gap: space.sm }}>
          {/* One confident door leads; the rest are quiet rows. Three
              identical ghost cards gave the final beat no momentum
              (gauntlet round 1, 2026-08-21). */}
          {doorsFor(kidName).map((item, index) => (
            <Pressable
              key={item.door}
              accessibilityRole="button"
              disabled={choosing}
              testID={`next.door.${item.door}`}
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
      </ScrollView>
    </WalkScene>
  );
}
