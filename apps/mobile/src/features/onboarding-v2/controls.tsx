/**
 * The lab's own small control set. Not a reskin of components/ui/button.tsx
 * (production's NativeAction sets its own internal colors from the Quiet
 * authority contract; fighting that for one bounded experiment is worse
 * than a short, self-contained set here). Motion numbers from the council
 * review section 4: press-in scale 0.97 over 100ms, fill via color
 * interpolation ~120ms, one hapticTick per selection.
 */
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { NativeText } from "../../components/ui/semantic";
import { hapticAdvance, hapticTick } from "../../lib/haptics";
import { v2Colors, v2Radii, v2Space, v2Type } from "./theme";

/**
 * Press state lives in plain React state; the shared-value mutation lives
 * in the effect that watches it, matching how every other shared value in
 * this lab is driven (Stage.tsx's Mascot and DockedProgressBar). The
 * compiler's immutability check only clears a `.value` write inside a
 * useEffect, never inside an event-handler closure, however that closure
 * is wired up, so onPressIn/onPressOut only ever call setPressed.
 */
function usePressScale() {
  const reducedMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  useEffect(() => {
    const target = pressed ? 0.97 : 1;
    scale.value = reducedMotion ? target : withTiming(target, { duration: 100 });
  }, [pressed, reducedMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => setPressed(true),
    onPressOut: () => setPressed(false),
  };
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Optional leading glyph, e.g. an SSO provider mark. */
  icon?: React.ReactNode;
}) {
  const press = usePressScale();
  const unavailable = disabled || busy;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: unavailable }}
        disabled={unavailable}
        onPress={() => {
          hapticAdvance();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          minHeight: 52,
          borderRadius: v2Radii.control,
          borderCurve: "continuous",
          backgroundColor: unavailable ? v2Colors.border : v2Colors.midnight,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: v2Space.sm,
          paddingHorizontal: v2Space.lg,
        }}
      >
        {icon}
        <NativeText style={[v2Type.control, { color: unavailable ? v2Colors.inkMuted : v2Colors.onMidnight }]}>
          {busy ? "…" : label}
        </NativeText>
      </Pressable>
    </Animated.View>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <NativeText style={[v2Type.caption, { color: v2Colors.coral, textAlign: "center" }]}>{label}</NativeText>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  role = "checkbox",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: "checkbox" | "radio";
}) {
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole={role}
        accessibilityState={{ selected, checked: selected }}
        onPress={() => {
          hapticTick();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          minHeight: 44,
          paddingHorizontal: v2Space.md,
          paddingVertical: v2Space.sm,
          borderRadius: v2Radii.chip,
          borderCurve: "continuous",
          borderWidth: 1.5,
          borderColor: selected ? v2Colors.coral : v2Colors.border,
          backgroundColor: selected ? v2Colors.midnight : v2Colors.paper,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <NativeText style={[v2Type.chip, { color: selected ? v2Colors.onMidnight : v2Colors.ink }]}>{label}</NativeText>
      </Pressable>
    </Animated.View>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: v2Space.sm }}>{children}</View>;
}

/** Vertical radio list, per the council review's native-ux finding: the
 * ladder needs 44pt rows at Dynamic Type XL, not a horizontal chip row. */
export function RadioRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected, checked: selected }}
        onPress={() => {
          hapticTick();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          minHeight: 52,
          paddingHorizontal: v2Space.md,
          borderRadius: v2Radii.control,
          borderCurve: "continuous",
          borderWidth: 1.5,
          borderColor: selected ? v2Colors.coral : v2Colors.border,
          backgroundColor: selected ? v2Colors.midnight : v2Colors.paper,
          justifyContent: "center",
        }}
      >
        <NativeText style={[v2Type.chip, { color: selected ? v2Colors.onMidnight : v2Colors.ink }]}>{label}</NativeText>
      </Pressable>
    </Animated.View>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  keyboardType,
  returnKeyType = "done",
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  keyboardType?: "default" | "numeric";
  returnKeyType?: "done" | "next";
  onSubmitEditing?: () => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={v2Colors.inkMuted}
      autoFocus={autoFocus}
      keyboardType={keyboardType}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      style={{
        minHeight: 52,
        borderRadius: v2Radii.control,
        borderCurve: "continuous",
        borderWidth: 1.5,
        borderColor: v2Colors.border,
        backgroundColor: v2Colors.paper,
        paddingHorizontal: v2Space.md,
        fontFamily: v2Type.chip.fontFamily,
        fontSize: v2Type.chip.fontSize,
        color: v2Colors.ink,
      }}
    />
  );
}

/** A minimal tag input: type, press return or the Add button, get a chip. */
export function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed.length > 0 && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setDraft("");
  };
  return (
    <View style={{ gap: v2Space.sm }}>
      {tags.length > 0 ? (
        <ChipRow>
          {tags.map((tag) => (
            <Chip key={tag} label={`${tag} ×`} selected onPress={() => onChange(tags.filter((t) => t !== tag))} />
          ))}
        </ChipRow>
      ) : null}
      <TextField
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        returnKeyType="done"
        onSubmitEditing={commit}
      />
    </View>
  );
}
