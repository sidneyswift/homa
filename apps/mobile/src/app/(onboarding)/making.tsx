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
import { firstMakingStopped } from "../../features/onboarding/making-status";
import { MakingFeatureCards } from "../../features/onboarding/making-feature-cards";
import { withMakingNote } from "../../features/onboarding/making-notes";
import { MakingShow } from "../../features/onboarding/making-show";
import {
  loadOnboardingAnswers,
  markOnboardingComplete,
  reportOnboardingExitedEarly,
  reportOnboardingStep,
  saveOnboardingStep,
  type DraftKid,
} from "../../features/onboarding/onboarding-state";
import { getMyChildren } from "../../lib/family";
import { colors, space } from "../../theme/app2";

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
  const { family, memberDisplayName } = useFamilyData();
  const parentFirstName = memberDisplayName?.trim().split(/\s+/u)[0] ?? null;
  const [childName, setChildName] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [phase, setPhase] = useState<"starting" | "building" | "failed">(
    "starting",
  );
  const [pageReady, setPageReady] = useState(false);
  // The feature-card intro (2026-09-01 direction: the wait teaches, it
  // never just waits) plays once per session, for every family, before
  // the checklist or the easel takes over. Derived, not synced: the real
  // job always wins, so a page that finishes early skips the cards
  // without needing an effect to reconcile two sources of truth.
  const [introFinished, setIntroFinished] = useState(false);
  const showIntro = !introFinished && !pageReady;
  // Whether the checklist has anything to ask this child at all (fetched
  // once, same position math checklist-takeover.tsx itself uses), and
  // whether she has since closed it or finished it.
  const [checklistChildId, setChecklistChildId] = useState<string | null>(null);
  const [checklistAvailable, setChecklistAvailable] = useState<
    "checking" | "yes" | "no"
  >("checking");
  const [checklistExited, setChecklistExited] = useState(false);
  const [chipLabels, setChipLabels] = useState<string[]>([]);
  const scoredRef = useRef(false);
  // The checklist's live position, kept so the ready banner's "See it"
  // can close the session through the SAME path as the checklist's own
  // close button (D8, ruled 2026-08-31: the old bypass skipped
  // finalize, so "See it" could carry an answered session past the
  // reveal unscored; one close path, spec Outcome 6).
  const checklistPositionRef = useRef<ChecklistExit | null>(null);
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
      {
        // The easel's fact chips: her verbatim answers, capped at three
        // (MakingShow's copy law: nothing on stage but her words).
        const answers2 = await loadOnboardingAnswers(family.id).catch(() => null);
        const first = answers2?.kids?.[0];
        if (!cancelled && first) {
          const loves = Array.isArray(first.love) ? first.love.slice(0, 2) : [];
          const working = Array.isArray(first.workingOn) ? first.workingOn.slice(0, 1) : [];
          setChipLabels([...loves, ...working].filter(Boolean).slice(0, 3));
        }
      }
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
        if (note) setNotes((current) => withMakingNote(current, note));
        if (job?.status === "completed") {
          await saveOnboardingStep(family.id, "reveal").catch(() => {});
          setPageReady(true);
          return;
        }
        if (firstMakingStopped(job?.status)) {
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

  // While she is actively answering, the page being ready only shows
  // the banner (the checklist waits for her). Once no checklist is on
  // screen, the easel show (MakingShow, wired per D9) owns the handoff:
  // its completing prop plays the ease-out exit and onExitDone routes
  // to the reveal, with reduced motion collapsing to an immediate call.
  const showingChecklist =
    checklistAvailable === "yes" && checklistChildId !== null && !checklistExited;

  // The page is the reward. Ready before the check-in has even appeared,
  // she sees the page first instead of a quiz standing in front of it
  // (gauntlet round 1, 2026-11-04: both mom reviewers would quit at "1 of
  // 16" with a finished page behind it). Once the check-in is on screen
  // she may be mid-answer, so the banner waits for her instead (D8):
  // keying this on answered === 0 cut a parent off on her first
  // question (round 3 walk).
  const checklistSeen = useRef(false);
  useEffect(() => {
    // Only a check-in that was on screen while the page was still being
    // made counts; the render where the page flips ready must not.
    if (!pageReady && !showIntro && showingChecklist) checklistSeen.current = true;
  }, [pageReady, showIntro, showingChecklist]);
  useEffect(() => {
    if (pageReady && !checklistSeen.current) setChecklistExited(true);
  }, [pageReady]);

  function handleChecklistClose(exit: ChecklistExit | null) {
    setChecklistExited(true);
    if (exit && exit.answered > 0 && !scoredRef.current) {
      scoredRef.current = true;
      void finalizeReport(exit.childId).catch(() => {});
    }
  }

  async function keepGoing() {
    if (!family) return;
    const children = await getMyChildren(family.id).catch(() => []);
    reportOnboardingExitedEarly(family.id, "making", children.length);
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
              {/* Vocabulary law D7 (copy deck, 2026-08-31): from this
                  screen on it is her page, never "worksheet". The heading
                  never says "making" over a banner that says the page is
                  ready (gauntlet round 1, 2026-11-04). */}
              {childName
                ? pageReady
                  ? `${childName}'s page is ready`
                  : `Making ${childName}'s page`
                : "Homa is getting her pencils"}
            </NativeText>

            {showIntro ? (
              <MakingFeatureCards
                onDone={() => setIntroFinished(true)}
                childName={childName || null}
                interest={chipLabels[0] ?? null}
              />
            ) : showingChecklist && checklistChildId ? (
              <>
                {/* The chapter cover (deck S8, D15): the heading says
                    what Homa is doing, so this line says what SHE is
                    about to do and why, by name (DELTA change 4: her
                    name lands the screen right after she gives it).
                    Once the page is ready, "While I draw" stops being
                    true, so the ready banner takes this slot instead. */}
                {pageReady ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: space.sm,
                      padding: space.sm,
                      borderRadius: 12,
                      backgroundColor: colors.surfaceSunken,
                    }}
                  >
                    <NativeText role="bodySmall" tone="strong" style={{ flex: 1 }}>
                      {/* The heading already says it is ready. */}
                      {"Take a look now, or keep answering."}
                    </NativeText>
                    {/* Through the one close path, never around it: an
                        answered session scores on the way out, and the
                        navigate effect below carries her to the reveal. */}
                    <Button
                      label="See it"
                      size="sm"
                      testID="making.seeIt"
                      onPress={() =>
                        handleChecklistClose(checklistPositionRef.current)
                      }
                    />
                  </View>
                ) : (
                  <NativeText role="body" tone="body">
                    {childName
                      ? parentFirstName
                        ? `While I work, ${parentFirstName}, tell me how ${childName}'s doing. Your answers start ${childName}'s progress report and set the level of the next page.`
                        : `While I work, tell me how ${childName}'s doing. Your answers start ${childName}'s progress report and set the level of the next page.`
                      : "While I work, tell me how your kid's doing. Your answers start their progress report and set the level of the next page."}
                  </NativeText>
                )}
                <ChecklistTakeover
                  childId={checklistChildId}
                  onClose={handleChecklistClose}
                  onPosition={(exit) => {
                    checklistPositionRef.current = exit;
                  }}
                  closeLabel="Keep exploring"
                  doneLabel={
                    pageReady
                      ? childName
                        ? `See ${childName}'s page`
                        : "See the page"
                      : "Done for now"
                  }
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

                {/* The easel show (D9, wired 2026-08-31): real work
                    depicted, preview structurally impossible, her own
                    answers as the set dressing. Its exit is the route
                    to the reveal. */}
                <MakingShow
                  chipLabels={chipLabels}
                  completing={pageReady}
                  onExitDone={() => router.replace("/reveal" as never)}
                />

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
                    testID="making.keepExploring"
                    onPress={() => void keepGoing()}
                  />
                  {/* Deck S8 (approved 2026-08-31): the time claim and
                      the unexplained "Binder" are both gone. */}
                  <NativeText role="caption" tone="muted">
                    The page is saved for you either way.
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
              {childName
                ? `Nothing you told me is lost. Ask me for ${childName}'s page in chat and I'll draw it there.`
                : "Nothing you told me is lost. Ask me for the page in chat and I'll draw it there."}
            </NativeText>
            <Button
              label="Take me in"
              size="lg"
              testID="making.takeMeIn"
              onPress={() => void keepGoing()}
            />
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
