import { MAP_INTERESTS_CAP } from "@homa/core";
import { useRef, useState } from "react";
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AccessibleModal } from "../../components/ui/accessible-modal";
import { NativeText } from "../../components/ui/semantic";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { CheckboxRow, PrimaryButton, TextLink } from "./controls";
import { canonicalInterestName, customInterestName, INTEREST_NAME_MAX_LENGTH, searchInterests, toggleInterest } from "./interest-options";
import { v2Colors, v2Radii, v2Space, v2Type } from "./theme";

export function InterestPicker({ childName, ageMonths, selected, onChange }: {
  childName: string;
  ageMonths: number | null;
  selected: string[];
  onChange: (names: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const title = `${childName}'s interests`;
  const atLimit = selected.length >= MAP_INTERESTS_CAP;
  const triggerRef = useRef<View>(null);
  const titleRef = useRef<View>(null);
  const listRef = useRef<FlatList<string>>(null);
  const results = searchInterests(query, ageMonths, selected, showAll);
  const customName = customInterestName(query, selected);
  const finishWithCustom = customName !== null && results.length === 0 && !atLimit;
  const selectedNames = selected.map(canonicalInterestName);
  useAccessibilityAnnouncement(open ? `${selected.length} selected` : null);

  function close() {
    Keyboard.dismiss();
    setOpen(false);
  }

  function changeQuery(value: string) {
    setQuery(value);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function addCustom() {
    if (!customName || atLimit) return;
    onChange(toggleInterest(selected, customName));
    close();
  }

  return (
    <View style={{ gap: v2Space.sm }}>
      <Pressable ref={triggerRef} accessibilityRole="button"
        accessibilityLabel="Search or add interests"
        accessibilityHint="Choose interests or add your own."
        accessibilityState={{ expanded: open }} accessibilityValue={{ text: `${selected.length} selected` }}
        onPress={() => { Keyboard.dismiss(); setQuery(""); setShowAll(false); setOpen(true); }}
        style={{ minHeight: 52, borderWidth: 1.5, borderColor: v2Colors.border, borderRadius: v2Radii.control,
          backgroundColor: v2Colors.paper, paddingHorizontal: v2Space.md, paddingVertical: v2Space.sm,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: v2Space.sm }}>
        <NativeText style={[v2Type.chip, { flex: 1, color: v2Colors.ink }]}>
          Search or add interests
        </NativeText>
        <NativeText accessible={false} style={[v2Type.chip, { color: v2Colors.inkMuted }]}>⌄</NativeText>
      </Pressable>
      {selected.length ? (
        <View style={{ paddingLeft: v2Space.md }}>
          {selected.map((name) => (
            <View key={name} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: v2Space.sm }}>
              <NativeText style={[v2Type.caption, { flex: 1, color: v2Colors.ink }]}>{name}</NativeText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name}`}
                onPress={() => onChange(toggleInterest(selected, name))}
                style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
                <NativeText accessible={false} style={[v2Type.chip, { color: v2Colors.inkMuted }]}>×</NativeText>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <AccessibleModal visible={open} title={title} initialFocusRef={titleRef}
        returnFocusRef={triggerRef} onRequestClose={close}>
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: v2Colors.page }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
              <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.md, paddingBottom: v2Space.md, gap: v2Space.sm }}>
                <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={title}>
                  <NativeText style={[v2Type.question, { color: v2Colors.ink }]}>{title}</NativeText>
                </View>
                <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>Choose a few favorites.</NativeText>
                <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: v2Colors.border,
                  borderRadius: v2Radii.control, backgroundColor: v2Colors.paper, paddingLeft: v2Space.md, paddingRight: v2Space.sm }}>
                  <TextInput accessibilityLabel="Search or add an interest" placeholder="Search or add an interest"
                    placeholderTextColor={v2Colors.inkMuted} value={query} onChangeText={changeQuery}
                    autoCorrect={false} autoCapitalize="none" maxLength={INTEREST_NAME_MAX_LENGTH} returnKeyType="done"
                    onSubmitEditing={customName ? addCustom : () => Keyboard.dismiss()}
                    style={[v2Type.chip, { flex: 1, minHeight: 52, color: v2Colors.ink, paddingVertical: v2Space.sm }]} />
                  {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => changeQuery("")}
                    style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}>
                    <NativeText accessible={false} style={[v2Type.chip, { color: v2Colors.inkMuted }]}>×</NativeText>
                  </Pressable> : null}
                </View>
              </View>
              <FlatList ref={listRef} data={results} extraData={selected} keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
                contentContainerStyle={{ paddingHorizontal: v2Space.lg, paddingBottom: v2Space.md, gap: v2Space.sm }}
                renderItem={({ item }) => <CheckboxRow label={item} selected={selectedNames.includes(item)}
                  disabled={atLimit && !selectedNames.includes(item)}
                  onPress={() => onChange(toggleInterest(selected, item))} />}
                ListHeaderComponent={customName && results.length > 0 ? <TextLink label={`Add “${customName}”`} onPress={addCustom} disabled={atLimit} /> : null}
                ListFooterComponent={!query.trim() && !showAll ? <TextLink label="See all interests" onPress={() => setShowAll(true)} /> : null}
                />
              <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.sm, paddingBottom: v2Space.md, gap: v2Space.sm }}>
                <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted, textAlign: "center" }]}>
                  {atLimit ? "Remove one interest to add another." : `${selected.length} selected`}
                </NativeText>
                <PrimaryButton label={finishWithCustom ? `Add “${customName}”` : "Done"} onPress={finishWithCustom ? addCustom : close} />
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </SafeAreaProvider>
      </AccessibleModal>
    </View>
  );
}
