import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";

import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import { NativeText } from "../../components/ui/semantic";
import { TextField } from "../../components/ui/text-field";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  loadOnboardingAnswers,
  reportOnboardingStep,
  saveOnboardingState,
  saveOnboardingStep,
  type DraftKid,
  type OnboardingIntent,
} from "../../features/onboarding/onboarding-state";
import { startFirstMaking } from "../../features/onboarding/making";
import { useWalkCharacterState } from "../../features/onboarding/walk-character";
import { WalkScene } from "../../features/onboarding/walk-scene";
import { interestWithGlyph, WorksheetPreviewCard } from "../../features/onboarding/worksheet-preview-card";
import { joinNatural, workingChipsForAge } from "../../features/onboarding/working-chips";
import { addChild, getMyChildren } from "../../lib/family";
import { hapticAdvance, hapticTick } from "../../lib/haptics";
import { colors, radius, space } from "../../theme/app2";

/**
 * Meet the kids (wireframe v4 step 4). One question per sub-step, a
 * why-line under every ask (Duolingo ABC), and the child's card
 * assembling as answers land (cadence laws 3 and 6: metabolize the
 * answer, give a possession). Each finished card becomes a real
 * children row; drafts persist in mobile_onboarding_state on every
 * answer, so abandoning mid-kid resumes exactly here.
 *
 * INTERIM COMPLETION POINT: the making (wave 3) is not built yet, so
 * "That's everyone" marks the walk complete and lands in the app. The
 * completed funnel EVENT stays unfired until the full walk exists.
 */

type SubStep = "name" | "age" | "love" | "working";

/**
 * Chips follow the age the parent just gave (founder question
 * 2026-08-21: a 13-year-old should not be offered trucks and
 * princesses, and "Letters" is wrong for a kid writing essays).
 * Three bands, tuned to what parents actually say at each age; the
 * free-text field remains the escape hatch on every band.
 */
function loveChipsForAge(age: number | null): string[] {
  if (age !== null && age <= 5) {
    return ["dinosaurs", "animals", "trucks", "princesses", "bugs", "drawing", "music", "blocks", "playing outside"];
  }
  if (age !== null && age >= 10) {
    return ["video games", "sports", "music", "anime", "art", "coding", "baking", "animals", "fantasy books"];
  }
  return ["dinosaurs", "animals", "space", "sports", "video games", "drawing", "baking", "music", "princesses"];
}

const emptyKid = (): DraftKid => ({
  name: "",
  age: null,
  love: [],
  workingOn: [],
  childId: null,
});

export default function KidsScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const [kids, setKids] = useState<DraftKid[]>([emptyKid()]);
  const [subStep, setSubStep] = useState<SubStep>("name");
  const [loveText, setLoveText] = useState("");
  const [workingText, setWorkingText] = useState("");
  const [workingOther, setWorkingOther] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardWillShow", () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener("keyboardWillHide", () => setKeyboardVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const reported = useRef(false);
  // Saves must wait for hydration: the save effect fires on mount with
  // the default empty draft, and if that write lands before the load
  // returns, a resumed walk's saved answers are wiped (found by the
  // gauntlet capture rig, 2026-08-21, and just as real on any resume).
  const hydrated = useRef(false);
  // Legacy: the intent ask that used to sit before this screen wrote
  // this field (cut 2026-09-02, gh#304); nothing sets it fresh anymore,
  // but a family who saved one under the old flow keeps it, carried
  // through every save so a kids write never wipes it (answers are
  // stored whole, live bug 2026-08-19).
  const intentRef = useRef<OnboardingIntent | undefined>(undefined);

  const kid = kids[kids.length - 1];

  // She visibly composes while the give-back line or a save is in
  // flight, and leans in (listening) while a question is on screen.
  useWalkCharacterState(saving ? "thinking" : "listening");

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "kids");
    // Resume with her words still there: hydrate drafts saved by a
    // previous sitting and land on the first unanswered field.
    void loadOnboardingAnswers(family.id).then((answers) => {
      intentRef.current = answers?.intent;
      const rawSaved = answers?.kids;
      hydrated.current = true;
      if (!rawSaved || rawSaved.length === 0) return;
      // A draft saved before love/workingOn became multi-select stored
      // them as a plain string; coerce so an old in-progress walk never
      // crashes joinNatural on resume.
      const toArray = (value: unknown): string[] =>
        Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
      const saved = rawSaved.map((draft) => ({
        ...draft,
        love: toArray(draft.love),
        workingOn: toArray(draft.workingOn),
      }));
      setKids(saved);
      const current = saved[saved.length - 1];
      if (!current.name.trim()) setSubStep("name");
      else if (current.age === null) setSubStep("age");
      else if (current.love.length === 0) setSubStep("love");
      else setSubStep("working");
    });
  }, [family]);

  // Every answer is durable the moment it lands (pause-anywhere law).
  useEffect(() => {
    if (!family || !hydrated.current) return;
    void saveOnboardingState(family.id, "kids", {
      ...(intentRef.current ? { intent: intentRef.current } : {}),
      kids,
    });
  }, [family, kids]);

  function updateKid(patch: Partial<DraftKid>) {
    setKids((current) => {
      const next = [...current];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });
  }

  function goTo(step: SubStep, patch?: Partial<DraftKid>) {
    hapticAdvance();
    if (patch) updateKid(patch);
    setError(null);
    setSubStep(step);
  }

  /**
   * Every ask can be walked back (R4), except the very first kid's name
   * card: sign-in and the greeting merged into one pre-auth screen
   * (founder direction 2026-09-03), so there is no later screen inside
   * the signed-in-only walk to return to anymore, and routing back to
   * sign-in itself would just bounce a session right back out (it
   * redirects away whenever one exists). firstKidNameCard below hides
   * the Back control for exactly that one case. From a later kid's
   * empty name card, back returns to the previous kid's summary.
   */
  function goBack() {
    setError(null);
    if (subStep === "age") return setSubStep("name");
    if (subStep === "love") return setSubStep("age");
    if (subStep === "working") return setSubStep("love");
    // name step:
    if (kids.length > 1 && !kid.name.trim()) {
      setKids((current) => current.slice(0, -1));
      setSubStep("working");
    }
    // else: the first kid's name card, nothing to go back to (see above).
  }

  const firstKidNameCard = kids.length === 1;

  function toggleLove(option: string) {
    hapticTick();
    const current = kid.love;
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    updateKid({ love: next });
  }

  function toggleWorkingOn(option: string) {
    hapticTick();
    const current = kid.workingOn;
    const next = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    updateKid({ workingOn: next });
  }

  function confirmLoves() {
    const typed = loveText.trim();
    const loves = typed ? [...kid.love, typed] : kid.love;
    if (loves.length === 0) return;
    if (typed) {
      setLoveText("");
      updateKid({ love: loves });
    }
    setSubStep("working");
  }

  async function finishKid(): Promise<boolean> {
    if (!family || !kid.name.trim() || kid.age === null) return false;
    // Already written as a real row (a back-and-forward revisit, or a
    // double tap): never insert the same child twice.
    if (kid.childId) return true;
    // Age is what the flow asks (the wireframe's ruling: birthday can
    // come later); the stored birthday is the age's midpoint estimate,
    // flagged approximate in the profile so a later screen can refine
    // it honestly.
    const now = new Date();
    const birthYear = now.getFullYear() - kid.age;
    const approxDate = new Date(Date.UTC(birthYear, now.getUTCMonth(), 1));
    approxDate.setUTCMonth(approxDate.getUTCMonth() - 6);
    const result = await addChild({
      familyId: family.id,
      name: kid.name.trim(),
      birthYear: approxDate.getUTCFullYear(),
      birthMonth: approxDate.getUTCMonth() + 1,
      birthDay: 15,
      // The flag is what lets a later surface (settings today) offer
      // the real birthday honestly instead of presenting the midpoint
      // estimate as a fact.
      birthdayApproximate: true,
      interests: kid.love,
      focus: kid.workingOn.length ? joinNatural(kid.workingOn) : "",
    });
    if (result.error) {
      setError("That didn't save. You can try again when you're ready.");
      return false;
    }
    // Capture the new row's id so the making knows which child the
    // first page is for. Newest matching name wins; RLS scopes the read.
    const childName = kid.name.trim();
    const children = await getMyChildren(family.id).catch(() => []);
    const match = [...children]
      .reverse()
      .find((child) => child.name.trim().toLowerCase() === childName.toLowerCase());
    if (match) updateKid({ childId: match.id });
    // EVERY kid's page starts building the moment their card is
    // complete, not when the walk ends: the bench (2026-08-21) measured
    // 72 to 211 seconds of build time that can run underneath the
    // remaining screens instead of after them, and siblings deserve the
    // same head start as kid one (founder call 2026-08-24). Idempotent
    // server-side (one first making per child, ever), so the making
    // screen's and the reveal's own starts land on these same jobs.
    // Fire and forget: a lost kick costs nothing, later screens start
    // it for real.
    if (match) {
      void startFirstMaking(match.id).catch(() => {});
    }
    return true;
  }

  async function anotherKid() {
    setSaving(true);
    const saved = await finishKid();
    setSaving(false);
    if (!saved) return;
    setKids((current) => [...current, emptyKid()]);
    setSubStep("name");
  }

  async function thatIsEveryone() {
    if (!family) return;
    setSaving(true);
    const saved = await finishKid();
    if (!saved) {
      setSaving(false);
      return;
    }
    // Walk v2 order (S6 -> S7): the parent screen follows the kids, so
    // the S8 chapter cover can greet her by the name she just gave.
    await saveOnboardingStep(family.id, "you").catch(() => {});
    reportOnboardingStep(family.id, "you");
    setSaving(false);
    router.replace("/you" as never);
  }

  const kidNumber = kids.length;
  const forward =
    subStep === "name"
      ? {
          label: kid.name.trim() ? `Meet ${kid.name.trim()}` : "Next",
          disabled: !kid.name.trim(),
          onPress: () => goTo("age"),
          testID: "kids.name.next",
        }
      : subStep === "age"
        ? { label: "Next", disabled: kid.age === null, onPress: () => goTo("love"), testID: "kids.age.next" }
        : subStep === "love"
          ? {
              label: "Next",
              disabled: !loveText.trim() && kid.love.length === 0,
              onPress: confirmLoves,
              testID: "kids.love.next",
            }
          : {
              label: saving
                ? "One moment…"
                : kidNumber === 1
                  ? `Make ${kid.name.trim()}'s worksheet`
                  : "That's everyone",
              disabled: kid.workingOn.length === 0 || saving,
              onPress: () => void thatIsEveryone(),
              testID: "kids.thatsEveryone",
            };
  // The worksheet fills in as she answers; it steps aside while a
  // keyboard is up so the forward button never leaves the screen.
  const preview = keyboardVisible ? null : (
    <WorksheetPreviewCard
      name={kid.name}
      age={kid.age}
      interests={[...kid.love, ...(loveText.trim() ? [loveText.trim()] : [])]}
      subjects={kid.workingOn}
    />
  );
  const heading =
    kidNumber === 1 ? "Who's the first worksheet for?" : "Who's the next worksheet for?";

  return (
    <WalkScene>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: space.lg,
            paddingTop: space.xl,
            gap: space.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Progress subStep={subStep} />

          {subStep === "name" ? (
            <View style={{ flex: 1, gap: space.md }}>
              <NativeText role="display" tone="strong">
                {heading}
              </NativeText>
              <NativeText role="caption" tone="muted">
                Just a first name. It goes at the top of the worksheet. More kids? Add them after this one.
              </NativeText>
              <TextField
                label="Your child's first name"
                value={kid.name}
                onChangeText={(name) => updateKid({ name })}
                autoCapitalize="words"
                autoComplete="off"
                placeholder="e.g. Maya"
                autoFocus
              />
            </View>
          ) : null}

          {subStep === "age" ? (
            <View style={{ flex: 1, gap: space.md }}>
              <NativeText role="display" tone="strong">
                {`How old is ${kid.name.trim()}?`}
              </NativeText>
              <NativeText role="caption" tone="muted">
                {"It's my starting point for the level. You can nudge it later."}
              </NativeText>
              <ChipGrid
                options={["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13+"]}
                selected={kid.age === null ? null : kid.age >= 13 ? "13+" : String(kid.age)}
                onPick={(value) => {
                  hapticTick();
                  updateKid({ age: value === "13+" ? 13 : Number(value) });
                }}
                fixedWidth
              />
            </View>
          ) : null}

          {subStep === "love" ? (
            <View style={{ flex: 1, gap: space.md }}>
              <NativeText role="display" tone="strong">
                {`What's ${kid.name.trim()} into right now?`}
              </NativeText>
              <NativeText role="caption" tone="muted">
                {"Pick a few. I'll build the worksheet around them."}
              </NativeText>
              <ChipGrid
                options={loveChipsForAge(kid.age)}
                selected={kid.love}
                onPick={toggleLove}
                display={interestWithGlyph}
              />
              <TextField
                label="Something else?"
                value={loveText}
                onChangeText={setLoveText}
                autoCapitalize="none"
                placeholder="Volcanoes, ocean animals, trains…"
              />
            </View>
          ) : null}

          {subStep === "working" ? (
            <View style={{ flex: 1, gap: space.md }}>
              <NativeText role="display" tone="strong">
                {`What's ${kid.name.trim()} working on?`}
              </NativeText>
              <NativeText role="caption" tone="muted">
                Pick what the worksheet practices.
              </NativeText>
              <ChipGrid
                options={workingChipsForAge(kid.age)}
                selected={kid.workingOn}
                onPick={toggleWorkingOn}
              />
              {workingOther ? (
                <TextField
                  label="Something else"
                  value={workingText}
                  onChangeText={setWorkingText}
                  autoFocus
                  placeholder="Cursive, Spanish, multiplication…"
                  onSubmitEditing={() => {
                    const typed = workingText.trim();
                    if (typed) toggleWorkingOn(typed);
                    setWorkingText("");
                    setWorkingOther(false);
                  }}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setWorkingOther(true)}
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: space.md,
                    minHeight: 44,
                    justifyContent: "center",
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: colors.border,
                  }}
                >
                  <NativeText role="body" tone="muted">
                    {"Something else…"}
                  </NativeText>
                </Pressable>
              )}

              {error ? <InlineError message={error} /> : null}
            </View>
          ) : null}
        </ScrollView>

        {/* One fixed footer for every step (gauntlet round 1, 2026-11-04):
            the forward button sits in the same place on all four steps
            and never drops below the fold when a step's chips wrap. The
            questions scroll above it; the worksheet rides on top of it. */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            gap: space.sm,
            backgroundColor: colors.page,
          }}
        >
          {preview ? <View style={{ marginBottom: space.sm }}>{preview}</View> : null}
          {subStep === "working" ? (
            <Pressable
              accessibilityRole="button"
              disabled={kid.workingOn.length === 0 || saving}
              testID="kids.addAnotherKid"
              onPress={() => void anotherKid()}
              style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
            >
              <NativeText role="control" tone={kid.workingOn.length === 0 || saving ? "muted" : "strong"}>
                {saving ? "One moment…" : "+ Add another kid"}
              </NativeText>
            </Pressable>
          ) : null}
          <Button
            label={forward.label}
            size="lg"
            disabled={forward.disabled}
            busy={subStep === "working" && saving}
            onPress={forward.onPress}
            testID={forward.testID}
          />
          {subStep === "name" && firstKidNameCard ? null : (
            <BackLink onPress={goBack} disabled={saving} />
          )}
        </View>
      </KeyboardAvoidingView>
    </WalkScene>
  );
}

function Progress({ subStep }: { subStep: SubStep }) {
  const order: SubStep[] = ["name", "age", "love", "working"];
  const position = order.indexOf(subStep);
  return (
    <View style={{ flexDirection: "row", gap: space.xs }}>
      {order.map((step, index) => (
        <View
          key={step}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            // Done recedes, doing leads (gauntlet round 2: near-black
            // finished segments outweighed the live one).
            backgroundColor:
              index < position
                ? colors.border
                : index === position
                  ? colors.action
                  : colors.borderSubtle,
          }}
        />
      ))}
    </View>
  );
}

function ChipGrid({
  options,
  selected,
  onPick,
  fixedWidth = false,
  display,
}: {
  options: string[];
  selected: string | string[] | null;
  onPick: (value: string) => void;
  fixedWidth?: boolean;
  /** What the chip shows; the value it saves is always the option. */
  display?: (option: string) => string;
}) {
  const isSelected = (option: string) =>
    Array.isArray(selected) ? selected.includes(option) : selected === option;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          shown={display ? display(option) : option}
          selected={isSelected(option)}
          onPress={() => onPick(option)}
          fixedWidth={fixedWidth}
        />
      ))}
    </View>
  );
}

function BackLink({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  // Back is the least important action on every ask; it speaks in
  // muted stone, never in clay (clay is for forward motion and the
  // mark; gauntlet round 1 found Back was the loudest color on screen).
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      disabled={disabled}
      style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
    >
      <NativeText role="control" tone="muted">
        Back
      </NativeText>
    </Pressable>
  );
}

function Chip({
  label,
  shown = label,
  selected,
  onPress,
  fixedWidth = false,
}: {
  label: string;
  shown?: string;
  selected: boolean;
  onPress: () => void;
  fixedWidth?: boolean;
}) {
  // Selected fills with the brand clay and speaks in cream; unselected
  // sits warm (clay wash) instead of form-outline white. The old
  // hairline-only selected state failed the glance test (gauntlet
  // round 1, 2026-08-21).
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: fixedWidth ? 0 : space.md,
        width: fixedWidth ? 52 : undefined,
        height: fixedWidth ? 52 : undefined,
        minHeight: fixedWidth ? 52 : 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: fixedWidth ? 26 : radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.action : colors.border,
        backgroundColor: selected ? colors.action : colors.card,
      }}
    >
      <NativeText role="body" tone={selected ? "inverse" : "strong"}>
        {shown}
      </NativeText>
    </Pressable>
  );
}
