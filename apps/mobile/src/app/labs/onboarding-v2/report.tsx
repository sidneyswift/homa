import {
  freeReportSubjects,
  lockedReportSubjects,
  MAP_SUBJECTS,
  scoreMap,
  type MapAnswerInput,
  type MapPosition,
} from "@homa/core";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { NativeText } from "../../../components/ui/semantic";
import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton } from "../../../features/onboarding-v2/controls";
import { ageInMonthsFromParts, useOnboardingV2 } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Radii, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

function positionPhrase(position: MapPosition, monthsAhead: number | null): string {
  switch (position) {
    case "ahead":
      return monthsAhead
        ? `about ${monthsAhead} month${monthsAhead === 1 ? "" : "s"} ahead of pace`
        : "ahead of pace";
    case "on_track":
      return "right on pace";
    case "growing":
      return "just getting started, and that's exactly where we begin";
    default:
      return "not mapped yet";
  }
}

/**
 * The real report lock (packages/core/src/map/report-lock.ts), the same
 * one production uses: four fixed subjects open (math, literacy, science,
 * social-emotional), the rest held for membership. Reusing it here instead
 * of inventing a lab-only free/paid split answers what would otherwise be
 * an unresolved founder decision with an already-shipped one.
 */
export default function ReportScreen() {
  const router = useRouter();
  const { state, firstChild } = useOnboardingV2();
  const name = firstChild?.name ?? "your kid";
  const ageMonths = firstChild ? ageInMonthsFromParts(firstChild.birthMonth, firstChild.birthYear) : 60;
  const answers: MapAnswerInput[] = useMemo(() => Object.values(state.answers), [state.answers]);
  const scores = useMemo(() => scoreMap(ageMonths, answers), [ageMonths, answers]);
  const freeIds = useMemo(() => new Set(freeReportSubjects(scores)), [scores]);
  const lockedIds = useMemo(() => new Set(lockedReportSubjects(scores)), [scores]);

  const strongest = scores.subjects.find((s) => s.subjectId === scores.strengthOrder[0]) ?? null;
  const strongestDomain = strongest ? MAP_SUBJECTS.find((s) => s.id === strongest.subjectId) : null;

  const BUBBLES = [
    `Here's ${name}'s first report.`,
    strongest && strongestDomain
      ? `${strongestDomain.displayName}: ${positionPhrase(strongest.position, strongest.monthsAhead)}.`
      : "Here's exactly where things stand.",
    lockedIds.size > 0
      ? `${freeIds.size} subject${freeIds.size === 1 ? " is" : "s are"} open below. The rest unlock with a membership.`
      : `All ${scores.mappedCount} subject${scores.mappedCount === 1 ? " is" : "s are"} open below.`,
  ];
  const [bubbleIndex, setBubbleIndex] = useState(0);
  const atLastBubble = bubbleIndex === BUBBLES.length - 1;

  const mappedSubjects = scores.subjects.filter((s) => s.position !== "not_mapped");

  return (
    <OnboardingStage
      posture="big"
      characterState="speaking"
      bubbleKey={`report-${bubbleIndex}`}
      bubble={BUBBLES[bubbleIndex]}
      footer={
        atLastBubble ? (
          <PrimaryButton label="See the week" onPress={() => router.push("/labs/onboarding-v2/week-reveal")} />
        ) : (
          <PrimaryButton label="Continue" onPress={() => setBubbleIndex((i) => i + 1)} />
        )
      }
    >
      {/* The report itself renders from the first frame, not behind two
       * taps: both gauntlet-loop critics independently flagged an early
       * text-only bubble with no visible payoff as the single biggest gap
       * against the reference. The bubbles narrate on top of real content
       * that was already there to look at. */}
      <View style={{ gap: v2Space.sm, paddingTop: v2Space.md }}>
        {mappedSubjects.map((s) => {
          const domain = MAP_SUBJECTS.find((d) => d.id === s.subjectId);
          const locked = lockedIds.has(s.subjectId);
          return (
            <View
              key={s.subjectId}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: v2Colors.paper,
                borderRadius: v2Radii.control,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: v2Colors.border,
                paddingHorizontal: v2Space.md,
                paddingVertical: v2Space.sm,
                opacity: locked ? 0.55 : 1,
              }}
            >
              <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>{domain?.displayName}</NativeText>
              <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
                {locked ? "Membership" : positionPhrase(s.position, s.monthsAhead)}
              </NativeText>
            </View>
          );
        })}
      </View>
    </OnboardingStage>
  );
}
