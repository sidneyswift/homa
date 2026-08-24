import { useRouter } from "expo-router";
import { useRef, useState } from "react";
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

import { AccessibleModal } from "../../components/ui/accessible-modal";
import { Button } from "../../components/ui/button";
import { Icon } from "../../components/design/icon";
import { IconButton } from "../../components/ui/icon-button";
import { InlineError } from "../../components/ui/inline-error";
import { NativeText } from "../../components/ui/semantic";
import { TextField } from "../../components/ui/text-field";
import { useWalkCharacterState } from "../../features/onboarding/walk-character";
import { saveWalkBasics } from "../../features/onboarding/basics";
import { WalkScene } from "../../features/onboarding/walk-scene";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

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
 * No step of its own in mobile_onboarding_state (the step column's
 * check constraint predates this screen): intent already saved step
 * "kids", so a walk resumed from here lands on the kid questions and
 * simply skips this ask. A rare, accepted loss over a schema change.
 */
export default function YouScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetHeadingRef = useRef<View>(null);
  useWalkCharacterState(saving ? "thinking" : "listening");

  const stateName =
    US_STATES.find((state) => state.code === stateCode)?.name ?? null;

  async function continueWalk() {
    if (saving) return;
    setError(null);
    if (!name.trim() && !stateCode) {
      router.replace("/kids" as never);
      return;
    }
    setSaving(true);
    const saved = await saveWalkBasics({
      callMeName: name.trim() || undefined,
      usState: stateCode ?? undefined,
    });
    setSaving(false);
    if (!saved) {
      setError("That didn't save. Try again, or skip for now.");
      return;
    }
    router.replace("/kids" as never);
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
          <NativeText role="display" tone="strong">
            {"Now, about you."}
          </NativeText>

          <View style={{ gap: space.xs }}>
            <TextField
              label="What should I call you?"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sarah"
              autoCapitalize="words"
            />
            <NativeText role="caption" tone="muted">
              {"You'll hear it in every hello."}
            </NativeText>
          </View>

          <View style={{ gap: space.xs }}>
            <NativeText role="label" tone="strong">
              {"Which state do you homeschool in?"}
            </NativeText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                stateName ? `State: ${stateName}. Change it` : "Choose your state"
              }
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
            <NativeText role="caption" tone="muted">
              {"Homeschool rules are state by state. I keep yours in mind."}
            </NativeText>
          </View>

          {error ? (
            <View style={{ gap: space.xs }}>
              <InlineError message={error} />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace("/kids" as never)}
                style={{ minHeight: 44, justifyContent: "center" }}
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
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.replace("/intent" as never)}
              style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
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
        onRequestClose={() => setPickerOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(51,42,33,0.42)",
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
              <IconButton label="Close" onPress={() => setPickerOpen(false)}>
                <Icon name="close" size={20} color={colors.textSubtle} />
              </IconButton>
            </View>
            <ScrollView
              showsVerticalScrollIndicator
              contentContainerStyle={{
                paddingHorizontal: space.lg,
                paddingBottom: space.lg,
              }}
            >
              {US_STATES.map((state) => {
                const selected = stateCode === state.code;
                return (
                  <Pressable
                    key={state.code}
                    accessibilityRole="button"
                    accessibilityLabel={state.name}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setStateCode(state.code);
                      setPickerOpen(false);
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
        </View>
      </AccessibleModal>
    </WalkScene>
  );
}
