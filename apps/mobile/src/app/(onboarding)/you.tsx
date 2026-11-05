import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { US_STATES } from "@homa/core";

import { useSession } from "../../features/auth/session-provider";

import { AccessibleModal } from "../../components/ui/accessible-modal";
import { Button } from "../../components/ui/button";
import { Icon } from "../../components/design/icon";
import { IconButton } from "../../components/ui/icon-button";
import { InlineError } from "../../components/ui/inline-error";
import { LoadingStatus } from "../../components/ui/loading-status";
import { NativeText } from "../../components/ui/semantic";
import { TextField } from "../../components/ui/text-field";
import { useWalkCharacterState } from "../../features/onboarding/walk-character";
import { saveWalkBasics } from "../../features/onboarding/basics";
import { searchStates } from "../../features/onboarding/state-search";
import {
  loadOnboardingAnswers,
  reportOnboardingStep,
  saveOnboardingStep,
} from "../../features/onboarding/onboarding-state";
import { useFamilyData } from "../../features/family/use-family-data";
import { hapticAdvance } from "../../lib/haptics";
import { WalkScene } from "../../features/onboarding/walk-scene";
import { colors, fontFamilies, fontSize, radius, space } from "../../theme/app2";

/**
 * About you (founder call 2026-08-24): the two facts about the PARENT
 * the whole product leans on and mobile never collected. Her name is
 * every greeting from here on; her state decides the homeschool rules
 * the hours and filing features answer to. One screen, two asks, both
 * skippable: she decides, and the walk never blocks on them.
 *
 * The state ask is a select field opening a scrollable sheet (founder
 * call, same day: fifty-one chips on the screen read as a wall, not a
 * question). The sheet follows the planner's bottom-sheet grammar.
 *
 * Walk v2 (S7): this screen follows the kids, so the making screen's
 * chapter cover can greet her by the name she just gave (DELTA change
 * 4). It carries its own resume step now that the step constraint
 * includes "you".
 */
export default function YouScreen() {
  const router = useRouter();
  const { family, memberDisplayName } = useFamilyData();
  const { session } = useSession();
  const isAppleSignIn = session?.user.app_metadata.provider === "apple";
  const providerName = session?.user.user_metadata.full_name;
  const knownName = memberDisplayName || (typeof providerName === "string" ? providerName : "");
  const reported = useRef(false);
  const [name, setName] = useState("");
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stateQuery, setStateQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kidName, setKidName] = useState<string | null>(null);
  const sheetHeadingRef = useRef<View>(null);
  useWalkCharacterState(saving ? "thinking" : "listening");

  const stateName =
    US_STATES.find((state) => state.code === stateCode)?.name ?? null;
  const stateMatches = searchStates(stateQuery);

  function closePicker() {
    setPickerOpen(false);
    setStateQuery("");
  }

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "you");
    void loadOnboardingAnswers(family.id)
      .then((answers) => setKidName(answers?.kids?.[0]?.name.trim() || null))
      .catch(() => {});
  }, [family]);

  async function advanceToMaking() {
    hapticAdvance();
    if (family) {
      await saveOnboardingStep(family.id, "making").catch(() => {});
      reportOnboardingStep(family.id, "making");
    }
    router.replace("/making" as never);
  }

  async function continueWalk() {
    if (saving) return;
    setError(null);
    const callMeName = isAppleSignIn ? knownName.trim() : name.trim();
    if (!callMeName && !stateCode) {
      await advanceToMaking();
      return;
    }
    setSaving(true);
    const saved = await saveWalkBasics({
      callMeName: callMeName || undefined,
      usState: stateCode ?? undefined,
    });
    setSaving(false);
    if (!saved) {
      setError("That didn't save. Try again, or skip for now.");
      return;
    }
    await advanceToMaking();
  }

  return (
    <WalkScene>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flex: 1,
            padding: space.lg,
            paddingTop: space.xl,
            gap: space.md,
          }}
        >
          {/* The last kid-card button reads "Make Theo's worksheet" and
              starts the build, but it lands here, on a form: two round 3
              reviewers (2026-11-04) read that as a broken promise. The
              build really is running (kids.tsx starts it; making.tsx
              re-requests it), so say so. */}
          {kidName ? (
            <View
              accessible
              accessibilityLabel={`Drawing ${kidName}'s page now`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                gap: space.xs,
                paddingHorizontal: space.sm,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceSunken,
              }}
            >
              <LoadingStatus
                label={`Drawing ${kidName}'s page now`}
                showLabel={false}
                style={{ minHeight: 0 }}
              />
              <NativeText role="caption" tone="strong">
                {`Drawing ${kidName}'s page now`}
              </NativeText>
            </View>
          ) : null}
          <NativeText role="display" tone="strong">
            {"And you?"}
          </NativeText>
          {/* Deck S7 (approved 2026-08-31): one body carries both
              justifications; the per-field captions are folded in. */}
          <NativeText role="body" tone="body">
            {isAppleSignIn
              ? "Your state. Homeschool rules are local, and I've done the reading for yours."
              : "Your name and your state. Homeschool rules are local, and I've done the reading for yours."}
          </NativeText>

          {!isAppleSignIn ? <View style={{ gap: space.xs }}>
            <TextField
              label="What should I call you?"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sarah"
              autoCapitalize="words"
            />
          </View> : null}

          <View style={{ gap: space.xs }}>
            <NativeText role="label" tone="strong">
              {"Which state do you homeschool in?"}
            </NativeText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                stateName ? `State: ${stateName}. Change it` : "Choose your state"
              }
              testID="you.stateRow"
              onPress={() => setPickerOpen(true)}
              style={{
                minHeight: 52,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: space.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.base,
                  color: stateName ? colors.textStrong : colors.textMuted,
                }}
              >
                {stateName ?? "Choose your state"}
              </Text>
              <Icon name="next" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {error ? (
            <View style={{ gap: space.xs }}>
              <InlineError message={error} />
              <Pressable
                accessibilityRole="button"
                onPress={() => void advanceToMaking()}
                style={{ minHeight: 44, justifyContent: "center" }}
                testID="you.skip"
              >
                <NativeText role="bodySmall" tone="muted">
                  {"Skip for now"}
                </NativeText>
              </Pressable>
            </View>
          ) : null}

          <View style={{ marginTop: "auto", gap: space.sm }}>
            <Button
              label={saving ? "One moment…" : "Continue"}
              size="lg"
              onPress={() => void continueWalk()}
              disabled={saving}
              busy={saving}
              testID="you.continue"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.replace("/kids" as never)}
              style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
              testID="you.back"
            >
              <NativeText role="control" tone="muted">
                Back
              </NativeText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <AccessibleModal
        visible={pickerOpen}
        title="Choose your state"
        initialFocusRef={sheetHeadingRef}
        transparent
        onRequestClose={closePicker}
      >
        {/* The search field lives in this bottom sheet, so the sheet
            rises with the keyboard; otherwise the keyboard covers it. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(32,33,36,0.42)",
          }}
        >
          <SafeAreaView
            style={{
              maxHeight: "80%",
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: space.lg,
                paddingBottom: space.sm,
              }}
            >
              <View
                ref={sheetHeadingRef}
                accessible
                accessibilityRole="header"
                accessibilityLabel="Choose your state"
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.display,
                    fontSize: fontSize.lg,
                    color: colors.textStrong,
                  }}
                >
                  Choose your state
                </Text>
              </View>
              <IconButton label="Close" onPress={closePicker}>
                <Icon name="close" size={20} color={colors.textSubtle} />
              </IconButton>
            </View>
            <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
              <TextField
                label="Find your state"
                value={stateQuery}
                onChangeText={setStateQuery}
                placeholder="Start typing, like Ohio"
                autoCapitalize="words"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="done"
                testID="you.stateSearch"
              />
            </View>
            <ScrollView
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: space.lg,
                paddingBottom: space.lg,
              }}
            >
              {stateMatches.length === 0 ? (
                <NativeText role="body" tone="muted">
                  {`No state starts with "${stateQuery.trim()}".`}
                </NativeText>
              ) : null}
              {stateMatches.map((state) => {
                const selected = stateCode === state.code;
                return (
                  <Pressable
                    key={state.code}
                    accessibilityRole="button"
                    accessibilityLabel={state.name}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setStateCode(state.code);
                      closePicker();
                    }}
                    style={{
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderSubtle,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: selected
                          ? fontFamilies.bodySemibold
                          : fontFamilies.body,
                        fontSize: fontSize.base,
                        color: colors.textStrong,
                      }}
                    >
                      {state.name}
                    </Text>
                    {selected ? (
                      <Icon name="check" size={20} color={colors.brand} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </AccessibleModal>
    </WalkScene>
  );
}
