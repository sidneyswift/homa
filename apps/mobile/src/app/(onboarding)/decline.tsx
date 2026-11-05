import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Button } from "../../components/ui/button";
import { LoadingStatus } from "../../components/ui/loading-status";
import { NativeText } from "../../components/ui/semantic";
import { useBillingGate } from "../../features/billing/use-billing-gate";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  loadOnboardingAnswers,
  markOnboardingComplete,
  reportOnboardingCompleted,
  reportOnboardingStep,
  saveOnboardingStep,
} from "../../features/onboarding/onboarding-state";
import { useWalkCharacterState, useWalkSky } from "../../features/onboarding/walk-character";
import { hapticAdvance } from "../../lib/haptics";
import { WalkScene } from "../../features/onboarding/walk-scene";
import { space } from "../../theme/app2";

/**
 * S11, the decline path (walk v2, D5 ruled 2026-08-31): only ever
 * reached from the paywall's "No thanks", and the first screen in the
 * walk that BRANCHES ON REAL JOURNEY STATE instead of assuming (spec
 * Outcome 2/6; the root fix for the honesty defect in spec 1.3). The
 * gate's reason decides which true thing to say:
 *
 *  - onboarding_grace: her free window is genuinely still open (she
 *    skipped or hasn't finished the checklist, no report scored), so
 *    the walk says so and the doors stay the natural next beat.
 *  - walled: the wall is armed. Her page stays hers (the read-only
 *    Binder exception in components/billing-gate.tsx), and the walk
 *    completes into the Binder.
 *
 * Deck strings verbatim (copy-deck.md §S11). Two ruled pieces are
 * deliberately absent until their machinery exists, per the deck's own
 * build-requirements clause: the "next page is on me" sentence waits
 * for the free-page credit, and the "Remind me later" snooze waits for
 * the D13 notification module (both flagged on gh#1045).
 */
/** The walk's beat layout (as in you.tsx): the words sit right under
 * Homa and the actions rest at the bottom. Centering the short copy in
 * the space below her left a tall blank band above the heading
 * (2026-11-03 walk, gh#1236). */
const BEAT_LAYOUT = { flex: 1, padding: space.lg, paddingTop: space.xl, gap: space.md } as const;
const ACTIONS_LAYOUT = { marginTop: "auto", gap: space.sm } as const;

export default function DeclineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trial?: string | string[] }>();
  const { family } = useFamilyData();
  const { gate, checked, refresh } = useBillingGate();
  const [childName, setChildName] = useState<string>("");
  const [kidsAdded, setKidsAdded] = useState(0);
  const [intent, setIntent] = useState<"worksheets" | "plan" | "hours" | "research" | "all">("all");
  const [leaving, setLeaving] = useState(false);
  const reported = useRef(false);
  useWalkCharacterState("idle");
  useWalkSky("clay");

  // Only the paywall routes here, and it knows whether the store is
  // actually offering the free week; the param keeps this screen from
  // promising a trial the store cannot start. A resume with no param
  // simply omits the secondary, never invents it.
  const trialOffered =
    (Array.isArray(params.trial) ? params.trial[0] : params.trial) === "1";

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "decline");
    void saveOnboardingStep(family.id, "decline").catch(() => {});
    void loadOnboardingAnswers(family.id)
      .then((answers) => {
        const kids = answers?.kids?.filter((kid) => kid.name.trim()) ?? [];
        if (kids[0]?.name) setChildName(kids[0].name.trim());
        setKidsAdded(kids.length);
        if (answers?.intent) setIntent(answers.intent);
      })
      .catch(() => {});
  }, [family]);

  async function completeIntoBinder() {
    if (!family || leaving) return;
    setLeaving(true);
    reportOnboardingCompleted(family.id, {
      kids_added: kidsAdded,
      intent,
      next_door: "binder",
      second_create_tapped: false,
    });
    await markOnboardingComplete(family.id);
    hapticAdvance();
    router.replace("/binder" as never);
  }

  if (!checked) {
    return (
      <WalkScene>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <LoadingStatus label="One moment" />
        </View>
      </WalkScene>
    );
  }

  if (gate === null) {
    return (
      <WalkScene>
        <View style={BEAT_LAYOUT}>
          <NativeText role="body" tone="body">
            That did not load. Check your connection and try again.
          </NativeText>
          <Button label="Try again" onPress={() => void refresh()} testID="decline.retry" />
        </View>
      </WalkScene>
    );
  }

  if (gate.reason !== "walled") {
    // The free window is really open (grace), or she is already
    // entitled (a restore landed mid-paywall): nothing to soften.
    return (
      <WalkScene>
        <View style={BEAT_LAYOUT}>
          <NativeText role="display" tone="strong">
            Take your time.
          </NativeText>
          <NativeText role="body" tone="body">
            {"Nothing's locked yet. When that's about to change, I'll say so."}
          </NativeText>
          <View style={ACTIONS_LAYOUT}>
            <Button
              label="Look around"
              size="lg"
              onPress={() => router.replace("/next" as never)}
              testID="decline.lookAround"
            />
          </View>
        </View>
      </WalkScene>
    );
  }

  return (
    <WalkScene>
      <View style={BEAT_LAYOUT}>
        <NativeText role="display" tone="strong">
          No pressure.
        </NativeText>
        <NativeText role="body" tone="body">
          {childName
            ? `${childName}'s page is yours to keep.`
            : "The page you made is yours to keep."}
        </NativeText>
        <View style={ACTIONS_LAYOUT}>
          <Button
            label={childName ? `See ${childName}'s page` : "See the page"}
            size="lg"
            onPress={() => void completeIntoBinder()}
            disabled={leaving}
            busy={leaving}
            testID="decline.seePage"
          />
          {trialOffered ? (
            <Button
              label="Actually, start the free week"
              variant="secondary"
              onPress={() => router.replace("/paywall" as never)}
              disabled={leaving}
              testID="decline.startFreeWeek"
            />
          ) : null}
        </View>
      </View>
    </WalkScene>
  );
}
