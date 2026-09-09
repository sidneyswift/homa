import { useRef, useState } from "react";
import { ActionSheetIOS, Keyboard, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NativeText } from "../../components/ui/semantic";
import { AccessibleModal } from "../../components/ui/accessible-modal";
import { hapticTick } from "../../lib/haptics";
import { v2Colors, v2Radii, v2Space, v2Type } from "./theme";

/** Native iOS selection without adding a native dependency to the isolated lab. */
export function SelectField({ label, value, options, onSelect }: {
  label: string;
  value: number | null;
  options: { label: string; value: number }[];
  onSelect: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View>(null);
  const titleRef = useRef<View>(null);
  const selected = options.find((option) => option.value === value);

  function select(next: number) {
    hapticTick();
    onSelect(next);
    setOpen(false);
  }

  function showOptions() {
    Keyboard.dismiss();
    if (Platform.OS !== "ios") {
      setOpen(true);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions({
      title: `Birth ${label.toLowerCase()}`,
      options: [...options.map((option) => option.value === value ? `${option.label} ✓` : option.label), "Cancel"],
      cancelButtonIndex: options.length,
      tintColor: v2Colors.midnight,
      userInterfaceStyle: "light",
    }, (index) => {
      const option = options[index];
      if (option) select(option.value);
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={`Birth ${label.toLowerCase()}`}
        accessibilityValue={{ text: selected?.label ?? "Not selected" }}
        accessibilityHint={`Opens ${label.toLowerCase()} choices`}
        onPress={showOptions}
        style={{ minHeight: 52, borderWidth: 1.5, borderColor: v2Colors.border, borderRadius: v2Radii.control,
          backgroundColor: v2Colors.paper, paddingHorizontal: v2Space.md, paddingVertical: v2Space.sm,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: v2Space.sm }}
      >
        <NativeText style={[v2Type.chip, { flexShrink: 1, color: selected ? v2Colors.ink : v2Colors.inkMuted }]}>
          {selected?.label ?? label}
        </NativeText>
        <NativeText accessible={false} style={[v2Type.chip, { color: v2Colors.inkMuted }]}>⌄</NativeText>
      </Pressable>
      <AccessibleModal visible={open} title={`Birth ${label.toLowerCase()}`} initialFocusRef={titleRef}
        returnFocusRef={triggerRef} onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: v2Colors.page, padding: v2Space.lg }}>
          <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={`Birth ${label.toLowerCase()}`}>
            <NativeText style={[v2Type.question, { color: v2Colors.ink }]}>{`Birth ${label.toLowerCase()}`}</NativeText>
          </View>
          <ScrollView style={{ marginTop: v2Space.md }}>
            {options.map((option) => (
              <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }}
                onPress={() => select(option.value)} style={{ padding: v2Space.md, minHeight: 52 }}>
                <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>{option.label}{value === option.value ? " ✓" : ""}</NativeText>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 44, justifyContent: "center" }}>
            <NativeText style={[v2Type.control, { color: v2Colors.ink, textAlign: "center" }]}>Cancel</NativeText>
          </Pressable>
        </SafeAreaView>
      </AccessibleModal>
    </View>
  );
}
