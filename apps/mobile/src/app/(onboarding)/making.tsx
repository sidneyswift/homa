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

import { Button } from "../../components/ui/button";
import { NativeText } from "../../components/ui/semantic";
import {
  fetchMapChild,
  finalizeReport,
} from "../../features/chat/onboarding-card-api";
import {
  checklistPositionFor,
} from "../../features/chat/onboarding-card-model";
import {
  ChecklistTakeover,
  type ChecklistExit,
} from "../../features/chat/checklist-takeover";
import { useWalkCharacterState } from "../../features/onboarding/walk-character";
import { WalkScene } from "../../features/onboarding/walk-scene";
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
import { colors, palette, space } from "../../theme/tokens";

/**
 * The making (wireframe v4 step 5, cadence FRAME then DO): the first
 * kid's page builds for real while she answers real questions about
 * that same kid (2026-08-23 direction: the wait is not idle, it is the
 * progress questionnaire). The job is durable server-side, so closing
 * the app never loses the page; it lands in the Binder regardless.
 * Steps come from the job's own progress notes; the interstitial never
 * claims work that is not happening (honest theater law).
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
  const [pageReady, setPageReady] = useState(false);
  // Whether the checklist has anything to ask this child at all (fetched
  // once, same position math checklist-takeover.tsx itself uses), and
  // whether she has since closed it or finished it.
  const [checklistChildId, setChecklistChildId] = useState<string | null>(null);
  const [checklistAvailable, setChecklistAvailable] = useState<
    "checking" | "yes" | "no"
  >("checking");
  const [checklistExited, setChecklistExited] = useState(false);
  const scoredRef = useRef(false);
  // The persistent walk character does the working posture; a silent
  // multi-minute build must read as patient drawing, never a freeze.
  useWalkCharacterState(phase === "failed" ? "idle" : "thinking", phase === "failed" ? null : "drawing");
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
      setChecklistChildId(target.childId);
      // Same position math the questionnaire itself uses: skip it
      // silently when there is nothing to ask (age out of range, or she
      // already answered everything for this child) rather than mount
      // it just to show an empty "questions complete" screen.
      void fetchMapChild(target.childId)
        .then((child) => {
          if (cancelled) return;
          setChecklistAvailable(
            checklistPositionFor(child).remaining > 0 ? "yes" : "no",
          );
        })
        .catch(() => {
          if (!cancelled) setChecklistAvailable("no");
        });

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
          setPageReady(true);
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

  // Nothing left to interrupt once the page is ready and she is not
  // mid-questionnaire: take her straight to the reveal, same as before
  // this feature existed. While she is actively answering, this waits
  // for her; the ready banner below is the only nudge.
  const showingChecklist =
    checklistAvailable === "yes" && checklistChildId !== null && !checklistExited;
  useEffect(() => {
    if (!pageReady || showingChecklist) return;
    router.replace("/reveal" as never);
  }, [pageReady, router, showingChecklist]);

  function handleChecklistClose(exit: ChecklistExit | null) {
    setChecklistExited(true);
    if (exit && exit.answered > 0 && !scoredRef.current) {
      scoredRef.current = true;
      void finalizeReport(exit.childId).catch(() => {});
    }
  }

  async function keepGoing() {
    if (!family) return;
    await markOnboardingComplete(family.id);
    router.replace("/");
  }

  const reduced = useReducedMotion();
  const doneNotes = notes.slice(0, -1);
  const currentNote = notes[notes.length - 1] ?? "Warming up the drawing table";
  // The checklist owns its own screen-reader focus; announcing the wait
  // note on top of it would fight her question, not help it.
  useAccessibilityAnnouncement(
    phase !== "failed" && !showingChecklist ? currentNote : null,
  );

  return (
    <WalkScene>
      <View
        style={{
          flex: 1,
          padding: space.lg,
          paddingTop: space.md,
          gap: space.md,
        }}
      >
        {phase !== "failed" ? (
          <>
            <NativeText role="display" tone="strong">
              {childName
                ? `Homa is drawing ${childName}'s page`
                : "Homa is getting her pencils"}
            </NativeText>

            {showingChecklist && checklistChildId ? (
              <>
                {/* The frame before the first question (founder call
                    2026-08-23): the heading says what Homa is doing, so
                    this line says what SHE is about to do and why, or a
                    bare question lands out of nowhere. Once the page is
                    ready, "While Homa draws" stops being true, so the
                    ready banner takes this slot instead. */}
                {pageReady ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: space.sm,
                      padding: space.sm,
                      borderRadius: 12,
                      backgroundColor: palette.gold100,
                    }}
                  >
                    <NativeText role="bodySmall" tone="strong" style={{ flex: 1 }}>
                      {childName ? `${childName}'s page is ready.` : "The page is ready."}
                    </NativeText>
                    <Button
                      label="See it"
                      size="sm"
                      onPress={() => router.replace("/reveal" as never)}
                    />
                  </View>
                ) : (
                  <NativeText role="body" tone="body">
                    {childName
                      ? `While Homa draws, answer a few quick questions about ${childName}. Each answer builds ${childName}'s progress report and shapes the lesson plans to come.`
                      : "While Homa draws, answer a few quick questions about your kid. Each answer builds their progress report and shapes the lesson plans to come."}
                  </NativeText>
                )}
                <ChecklistTakeover
                  childId={checklistChildId}
                  onClose={handleChecklistClose}
                  closeLabel="Keep exploring"
                />
              </>
            ) : (
              <>
                {checklistAvailable === "checking" ? null : checklistExited ? (
                  <NativeText role="bodySmall" tone="body">
                    {childName
                      ? `Got it. That helps me know ${childName} better.`
                      : "Got it. That helps me know your kid better."}
                  </NativeText>
                ) : null}

                {/* The honesty ribbon: the job's real notes are the only
                    claimed progress. Done notes recede; the live one
                    keeps its moving ink. */}
                <View style={{ gap: space.xs }}>
                  {doneNotes.map((note) => (
                    <Animated.View
                      key={note}
                      entering={reduced ? undefined : FadeInDown.duration(280)}
                    >
                      <NativeText role="caption" tone="muted">
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
                </View>

                <View style={{ marginTop: "auto", gap: space.xs }}>
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
                </View>
              </>
            )}
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
    </WalkScene>
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
