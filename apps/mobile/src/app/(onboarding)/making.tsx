import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { NativeText } from "../../components/ui/semantic";
import { HomaCharacter } from "../../features/voice/homa-character";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { useFamilyData } from "../../features/family/use-family-data";
import { getMakingStatus, startFirstMaking } from "../../features/onboarding/making";
import {
  loadOnboardingAnswers,
  markOnboardingComplete,
  reportOnboardingStep,
  saveOnboardingStep,
  type DraftKid,
} from "../../features/onboarding/onboarding-state";
import { getMyChildren } from "../../lib/family";
import { colors, space } from "../../theme/tokens";

/**
 * The making (wireframe v4 step 5, cadence FRAME then DO): the first
 * kid's page builds for real while named, true steps tick. The job is
 * durable server-side, so closing the app never loses the page; it
 * lands in the Binder regardless. Steps come from the job's own
 * progress notes; the interstitial never claims work that is not
 * happening (honest theater law).
 */
const POLL_MS = 4_000;

export default function MakingScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const [childName, setChildName] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [phase, setPhase] = useState<"starting" | "building" | "failed">(
    "starting",
  );
  const started = useRef(false);

  useEffect(() => {
    if (!family || started.current) return;
    started.current = true;
    reportOnboardingStep(family.id, "making");
    void saveOnboardingStep(family.id, "making").catch(() => {});

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function firstKidChildId(): Promise<{
      childId: string;
      name: string;
    } | null> {
      if (!family) return null;
      const answers = await loadOnboardingAnswers(family.id);
      const kids: DraftKid[] = answers?.kids ?? [];
      const first = kids[0];
      if (!first) return null;
      if (first.childId) return { childId: first.childId, name: first.name };
      // The draft may not have flushed its childId; match the row by name.
      const children = await getMyChildren(family.id).catch(() => []);
      const match = children.find(
        (child) =>
          child.name.trim().toLowerCase() === first.name.trim().toLowerCase(),
      );
      return match ? { childId: match.id, name: first.name } : null;
    }

    void (async () => {
      const target = await firstKidChildId();
      if (cancelled) return;
      if (!target) {
        setPhase("failed");
        return;
      }
      setChildName(target.name.trim());
      const startResult = await startFirstMaking(target.childId);
      if (cancelled) return;
      if (!startResult) {
        setPhase("failed");
        return;
      }
      setPhase("building");

      const poll = async () => {
        const job = await getMakingStatus(startResult.jobId);
        if (cancelled) return;
        // Something true on screen from the very first beat: the job's
        // own note once it has one, its honest queue state until then.
        const note =
          job?.progressNote ??
          (job?.status === "queued"
            ? "In line at the drawing table"
            : job?.status === "running"
              ? "Pencils are moving"
              : null);
        if (note) {
          setNotes((current) =>
            current[current.length - 1] === note
              ? current
              : [...current.slice(-3), note],
          );
        }
        if (job?.status === "completed") {
          await saveOnboardingStep(family.id, "reveal").catch(() => {});
          router.replace("/reveal" as never);
          return;
        }
        if (job?.status === "failed" || job?.status === "cancelled") {
          setPhase("failed");
          return;
        }
        timer = setTimeout(() => void poll(), POLL_MS);
      };
      void poll();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [family, router]);

  async function keepGoing() {
    if (!family) return;
    await markOnboardingComplete(family.id);
    router.replace("/");
  }

  const reduced = useReducedMotion();
  const doneNotes = notes.slice(0, -1);
  const currentNote = notes[notes.length - 1] ?? "Warming up the drawing table";
  useAccessibilityAnnouncement(phase !== "failed" ? currentNote : null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: space.lg,
          gap: space.md,
        }}
      >
        {/* She is visibly at work the whole wait: the living mark from
            the voice screen in its thinking posture, built so a silent
            long job reads as patient drawing, never a freeze. */}
        <View style={{ alignItems: "center", marginBottom: space.md }}>
          <HomaCharacter state={phase === "failed" ? "idle" : "thinking"} size={120} />
        </View>

        {phase !== "failed" ? (
          <>
            <NativeText role="display" tone="strong">
              {childName
                ? `Homa is drawing ${childName}'s page`
                : "Homa is getting her pencils"}
            </NativeText>
            <NativeText role="body" tone="body">
              Give me a minute. This part is fun.
            </NativeText>
            <Card style={{ gap: space.sm }}>
              {/* Finished steps keep their checkmark and settle into the
                  card; the current step carries moving ink dots instead,
                  so live work never reads as done (founder feedback
                  2026-08-21). */}
              {doneNotes.map((note) => (
                <Animated.View
                  key={note}
                  entering={reduced ? undefined : FadeInDown.duration(280)}
                >
                  <NativeText role="body" tone="muted">
                    {`✓ ${note}`}
                  </NativeText>
                </Animated.View>
              ))}
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={currentNote}
                style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
              >
                <InkDots color={colors.brand} />
                <NativeText role="body" tone="strong">
                  {currentNote}
                </NativeText>
              </View>
            </Card>
            <Button
              label="Keep exploring while it draws"
              variant="secondary"
              size="lg"
              onPress={() => void keepGoing()}
            />
            <NativeText role="caption" tone="muted">
              It takes a few minutes and finishes on its own. The page
              lands in your Binder either way.
            </NativeText>
          </>
        ) : (
          <>
            <NativeText role="display" tone="strong">
              The drawing table hiccupped
            </NativeText>
            <NativeText role="body" tone="body">
              {"Nothing is lost. The page keeps trying on its own and lands in your Binder when it's ready."}
            </NativeText>
            <Button label="Take me in" size="lg" onPress={() => void keepGoing()} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * Three ink dots rising and settling in turn, the "she is drawing right
 * now" cue on the current step. Deliberately not the OS spinner: dots
 * in the brand ink, timed like a relaxed pen tap. Under reduced motion
 * they hold still; the row's progressbar role still says it is live.
 */
function InkDots({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const first = useSharedValue(0);
  const second = useSharedValue(0);
  const third = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const hop = () =>
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 520 }),
        ),
        -1,
      );
    first.value = hop();
    second.value = withDelay(160, hop());
    third.value = withDelay(320, hop());
    return () => {
      cancelAnimation(first);
      cancelAnimation(second);
      cancelAnimation(third);
    };
  }, [reduced, first, second, third]);

  const firstStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: first.value }],
  }));
  const secondStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: second.value }],
  }));
  const thirdStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: third.value }],
  }));

  const dot = { width: 6, height: 6, borderRadius: 3, backgroundColor: color };
  return (
    <View
      style={{ flexDirection: "row", gap: 4, alignItems: "center" }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[dot, firstStyle]} />
      <Animated.View style={[dot, secondStyle]} />
      <Animated.View style={[dot, thirdStyle]} />
    </View>
  );
}
