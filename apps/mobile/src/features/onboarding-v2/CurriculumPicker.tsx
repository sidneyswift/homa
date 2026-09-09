import { useRef, useState } from "react";
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AccessibleModal } from "../../components/ui/accessible-modal";
import { NativeText } from "../../components/ui/semantic";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { CheckboxRow, PrimaryButton } from "./controls";
import { canonicalCurriculumName, customCurriculumName, searchCurricula, toggleCurriculum, type CurriculumOption } from "./curriculum-catalog";
import { v2Colors, v2Radii, v2Space, v2Type } from "./theme";

export function CurriculumPicker({ selected, onChange }: {
  selected: string[];
  onChange: (names: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<View>(null);
  const titleRef = useRef<View>(null);
  const listRef = useRef<FlatList<CurriculumOption>>(null);
  const results = searchCurricula(query, selected);
  const customName = customCurriculumName(query, selected);
  const selectedNames = selected.map(canonicalCurriculumName);
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
    if (!customName) return;
    onChange(toggleCurriculum(selected, customName));
    changeQuery(customName);
    Keyboard.dismiss();
  }

  return (
    <View style={{ gap: v2Space.sm }}>
      <Pressable ref={triggerRef} accessibilityRole="button"
        accessibilityLabel="Search or add curriculum"
        accessibilityHint="Opens curriculum choices. Select all you use or add your own."
        accessibilityState={{ expanded: open }} accessibilityValue={{ text: `${selected.length} selected` }}
        onPress={() => { Keyboard.dismiss(); setQuery(""); setOpen(true); }}
        style={{ minHeight: 52, borderWidth: 1.5, borderColor: v2Colors.border, borderRadius: v2Radii.control,
          backgroundColor: v2Colors.paper, paddingHorizontal: v2Space.md, paddingVertical: v2Space.sm,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: v2Space.sm }}>
        <NativeText style={[v2Type.chip, { flex: 1, color: v2Colors.ink }]}>
          Search or add curriculum
        </NativeText>
        <NativeText accessible={false} style={[v2Type.chip, { color: v2Colors.inkMuted }]}>⌄</NativeText>
      </Pressable>
      {selected.length ? (
        <View style={{ paddingLeft: v2Space.md }}>
          {selected.map((name) => (
            <View key={name} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: v2Space.sm }}>
              <NativeText style={[v2Type.caption, { flex: 1, color: v2Colors.ink }]}>{name}</NativeText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name}`}
                onPress={() => onChange(toggleCurriculum(selected, name))}
                style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
                <NativeText accessible={false} style={[v2Type.chip, { color: v2Colors.inkMuted }]}>×</NativeText>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <AccessibleModal visible={open} title="Your curriculum" initialFocusRef={titleRef}
        returnFocusRef={triggerRef} onRequestClose={close}>
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: v2Colors.page }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
              <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.md, paddingBottom: v2Space.md, gap: v2Space.sm }}>
                <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel="Your curriculum">
                  <NativeText style={[v2Type.question, { color: v2Colors.ink }]}>Your curriculum</NativeText>
                </View>
                <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>Choose all you use.</NativeText>
                <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: v2Colors.border,
                  borderRadius: v2Radii.control, backgroundColor: v2Colors.paper, paddingLeft: v2Space.md, paddingRight: v2Space.sm }}>
                  <TextInput accessibilityLabel="Search or add a curriculum" placeholder="Search or add a curriculum"
                    placeholderTextColor={v2Colors.inkMuted} value={query} onChangeText={changeQuery}
                    autoCorrect={false} autoCapitalize="none" maxLength={120} returnKeyType="done"
                    onSubmitEditing={customName ? addCustom : () => Keyboard.dismiss()}
                    style={[v2Type.chip, { flex: 1, minHeight: 52, color: v2Colors.ink, paddingVertical: v2Space.sm }]} />
                  {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => changeQuery("")}
                    style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}>
                    <NativeText accessible={false} style={[v2Type.chip, { color: v2Colors.inkMuted }]}>×</NativeText>
                  </Pressable> : null}
                </View>
              </View>
              <FlatList ref={listRef} data={results} extraData={selected} keyExtractor={(item) => item.name}
                keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
                contentContainerStyle={{ paddingHorizontal: v2Space.lg, paddingBottom: v2Space.md, gap: v2Space.sm }}
                renderItem={({ item }) => <CheckboxRow label={item.name} selected={selectedNames.includes(item.name)}
                  onPress={() => onChange(toggleCurriculum(selected, item.name))} />}
                ListEmptyComponent={<NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>No matches.</NativeText>} />
              <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.sm, paddingBottom: v2Space.md, gap: v2Space.sm }}>
                <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted, textAlign: "center" }]}>
                  {selected.length} selected
                </NativeText>
                <PrimaryButton label={customName ? `Add “${customName}”` : "Done"} onPress={customName ? addCustom : close} />
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </SafeAreaProvider>
      </AccessibleModal>
    </View>
  );
}
