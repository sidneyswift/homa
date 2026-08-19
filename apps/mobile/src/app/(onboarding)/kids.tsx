import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { InlineError } from "../../components/ui/inline-error";
import { NativeText } from "../../components/ui/semantic";
import { TextField } from "../../components/ui/text-field";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  loadOnboardingAnswers,
  reportOnboardingStep,
  saveOnboardingState,
  type DraftKid,
} from "../../features/onboarding/onboarding-state";
import { fetchReactLine } from "../../features/onboarding/react-lines";
import { addChild, getMyChildren } from "../../lib/family";
import { colors, radius, space } from "../../theme/tokens";

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

type SubStep = "name" | "age" | "love" | "react" | "working";

const LOVE_CHIPS = [
  "dinosaurs",
  "animals",
  "space",
  "trucks",
  "princesses",
  "sports",
  "music",
  "baking",
  "drawing",
  "video games",
];

const WORKING_CHIPS = [
  "Letters",
  "Counting",
  "Reading",
  "Writing",
  "Math facts",
  "Handwriting",
  "Science",
];

const LEVELS: { key: DraftKid["level"] & string; label: string }[] = [
  { key: "starting", label: "Just starting" },
  { key: "getting_it", label: "Getting it" },
  { key: "flying", label: "Flying" },
];

const emptyKid = (): DraftKid => ({
  name: "",
  age: null,
  love: null,
  workingOn: null,
  level: null,
  childId: null,
});

export default function KidsScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const [kids, setKids] = useState<DraftKid[]>([emptyKid()]);
  const [subStep, setSubStep] = useState<SubStep>("name");
  const [loveText, setLoveText] = useState("");
  const [reactLine, setReactLine] = useState<string | null>(null);
  const [fetchingLine, setFetchingLine] = useState(false);
  const [priorLines, setPriorLines] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reported = useRef(false);

  const kid = kids[kids.length - 1];

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "kids");
    // Resume with her words still there: hydrate drafts saved by a
    // previous sitting and land on the first unanswered field.
    void loadOnboardingAnswers(family.id).then((answers) => {
      const saved = answers?.kids;
      if (!saved || saved.length === 0) return;
      setKids(saved);
      const current = saved[saved.length - 1];
      if (!current.name.trim()) setSubStep("name");
      else if (current.age === null) setSubStep("age");
      else if (!current.love) setSubStep("love");
      else setSubStep("working");
    });
  }, [family]);

  // Every answer is durable the moment it lands (pause-anywhere law).
  useEffect(() => {
    if (!family) return;
    void saveOnboardingState(family.id, "kids", { kids });
  }, [family, kids]);

  function updateKid(patch: Partial<DraftKid>) {
    setKids((current) => {
      const next = [...current];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });
  }

  function goTo(step: SubStep, patch?: Partial<DraftKid>) {
    if (patch) updateKid(patch);
    setError(null);
    setSubStep(step);
  }

  async function loveChosen(love: string) {
    if (fetchingLine) return;
    updateKid({ love });
    // The react screen arrives whole, once: fetch before switching
    // (founder feedback 2026-08-18, no placeholder-then-swap).
    setFetchingLine(true);
    const line = await fetchReactLine({
      kind: "love",
      childName: kid.name,
      love,
      priorLines,
    });
    setPriorLines((lines) => [...lines, line]);
    setReactLine(line);
    setFetchingLine(false);
    setSubStep("react");
  }

  async function finishKid(): Promise<boolean> {
    if (!family || !kid.name.trim() || kid.age === null) return false;
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
      interests: kid.love ? [kid.love] : [],
      focus: kid.workingOn
        ? `${kid.workingOn}${kid.level ? ` (${kid.level.replace("_", " ")})` : ""}`
        : "",
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
    reportOnboardingStep(family.id, "making");
    setSaving(false);
    router.replace("/making" as never);
  }

  const kidNumber = kids.length;
  const heading =
    kidNumber === 1 ? "Who are we teaching?" : "Who else are we teaching?";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: space.lg,
            gap: space.md,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Progress subStep={subStep} />

          {subStep === "name" ? (
            <View style={{ gap: space.md }}>
              <NativeText role="display" tone="strong">
                {heading}
              </NativeText>
              <NativeText role="caption" tone="muted">
                First name is enough. It goes on their worksheet.
              </NativeText>
              <TextField
                label="First name"
                value={kid.name}
                onChangeText={(name) => updateKid({ name })}
                autoCapitalize="words"
                autoComplete="off"
              />
              <Button
                label={kid.name.trim() ? `Meet ${kid.name.trim()}` : "Next"}
                size="lg"
                disabled={!kid.name.trim()}
                onPress={() => goTo("age")}
              />
            </View>
          ) : null}

          {subStep === "age" ? (
            <View style={{ gap: space.md }}>
              <NativeText role="display" tone="strong">
                {`How old is ${kid.name.trim()}?`}
              </NativeText>
              <NativeText role="caption" tone="muted">
                Everything I make gets pitched to their age.
              </NativeText>
              <ChipGrid
                options={["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13+"]}
                selected={kid.age === null ? null : kid.age >= 13 ? "13+" : String(kid.age)}
                onPick={(value) =>
                  updateKid({ age: value === "13+" ? 13 : Number(value) })
                }
              />
              <Button
                label="Next"
                size="lg"
                disabled={kid.age === null}
                onPress={() => goTo("love")}
              />
            </View>
          ) : null}

          {subStep === "love" ? (
            <View style={{ gap: space.md }}>
              <NativeText role="display" tone="strong">
                {`What does ${kid.name.trim()} love right now?`}
              </NativeText>
              <NativeText role="caption" tone="muted">
                This is my secret ingredient.
              </NativeText>
              <ChipGrid
                options={LOVE_CHIPS}
                selected={kid.love}
                onPick={(love) => void loveChosen(love)}
              />
              <TextField
                label="Or type anything"
                value={loveText}
                onChangeText={setLoveText}
                autoCapitalize="none"
              />
              <Button
                label={fetchingLine ? "One moment…" : "Next"}
                size="lg"
                disabled={(!loveText.trim() && !kid.love) || fetchingLine}
                busy={fetchingLine}
                onPress={() => {
                  const typed = loveText.trim();
                  if (typed) {
                    setLoveText("");
                    void loveChosen(typed);
                  } else if (kid.love) {
                    setSubStep("react");
                  }
                }}
              />
            </View>
          ) : null}

          {subStep === "react" ? (
            <View style={{ gap: space.md }}>
              <Card style={{ gap: space.sm }}>
                <NativeText role="bodyLarge" tone="strong">
                  {reactLine ?? "…"}
                </NativeText>
              </Card>
              <KidCard kid={kid} pendingLabel="working on: …" />
              <Button label="Next" size="lg" onPress={() => goTo("working")} />
            </View>
          ) : null}

          {subStep === "working" ? (
            <View style={{ gap: space.md }}>
              <NativeText role="display" tone="strong">
                {`What's ${kid.name.trim()} working on?`}
              </NativeText>
              <NativeText role="caption" tone="muted">
                So the worksheet lands right at their edge.
              </NativeText>
              <ChipGrid
                options={WORKING_CHIPS}
                selected={kid.workingOn}
                onPick={(workingOn) => updateKid({ workingOn })}
              />

              {kid.workingOn ? (
                // The second question appears only once the first is
                // answered; two chip sets in one flat list read as one
                // confusing choice (founder feedback 2026-08-18).
                <View style={{ gap: space.sm, marginTop: space.sm }}>
                  <NativeText role="label" tone="strong">
                    {`How's ${kid.name.trim()} doing with ${kid.workingOn.toLowerCase()}?`}
                  </NativeText>
                  <View style={{ flexDirection: "row", gap: space.sm }}>
                    {LEVELS.map((level) => (
                      <Chip
                        key={level.key}
                        label={level.label}
                        selected={kid.level === level.key}
                        onPress={() => updateKid({ level: level.key })}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <KidCard kid={kid} />

              {error ? <InlineError message={error} /> : null}

              <Button
                label={saving ? "One moment…" : "Add another kid"}
                variant="secondary"
                disabled={!kid.workingOn || saving}
                busy={saving}
                onPress={() => void anotherKid()}
              />
              <Button
                label={saving ? "One moment…" : "That's everyone"}
                size="lg"
                disabled={!kid.workingOn || saving}
                busy={saving}
                onPress={() => void thatIsEveryone()}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Progress({ subStep }: { subStep: SubStep }) {
  const order: SubStep[] = ["name", "age", "love", "react", "working"];
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
            backgroundColor:
              index <= position ? colors.textStrong : colors.borderSubtle,
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
}: {
  options: string[];
  selected: string | null;
  onPick: (value: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={selected === option}
          onPress={() => onPick(option)}
        />
      ))}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: space.md,
        minHeight: 44,
        justifyContent: "center",
        borderRadius: radius.pill,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.textStrong : colors.border,
        backgroundColor: colors.card,
      }}
    >
      <NativeText role="body" tone={selected ? "strong" : "body"}>
        {label}
      </NativeText>
    </Pressable>
  );
}

/** The possession: the child's card, assembling as answers land. */
function KidCard({
  kid,
  pendingLabel,
}: {
  kid: DraftKid;
  pendingLabel?: string;
}) {
  const workingLine = kid.workingOn
    ? `working on ${kid.workingOn.toLowerCase()}${
        kid.level ? ` · ${kid.level.replace("_", " ")}` : ""
      }`
    : pendingLabel ?? null;
  return (
    <Card style={{ gap: space.xs, borderColor: colors.textStrong, borderWidth: 1.5 }}>
      <NativeText role="bodyLarge" tone="strong">
        {`${kid.name.trim()}${kid.age !== null ? `, ${kid.age}` : ""}`}
      </NativeText>
      {kid.love ? (
        <NativeText role="body" tone="body">
          {`loves ${kid.love}`}
        </NativeText>
      ) : null}
      {workingLine ? (
        <NativeText role="body" tone="muted">
          {workingLine}
        </NativeText>
      ) : null}
    </Card>
  );
}
