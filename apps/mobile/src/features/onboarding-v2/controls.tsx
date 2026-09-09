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
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Optional leading glyph, e.g. an SSO provider mark. */
  icon?: React.ReactNode;
  variant?: "primary" | "secondary";
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
          backgroundColor: unavailable ? v2Colors.border : variant === "secondary" ? v2Colors.paper : v2Colors.midnight,
          borderWidth: variant === "secondary" ? 1.5 : 0,
          borderColor: v2Colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: v2Space.sm,
          paddingHorizontal: v2Space.lg,
        }}
      >
        {icon}
        <NativeText style={[v2Type.control, { color: unavailable ? v2Colors.inkMuted : variant === "secondary" ? v2Colors.ink : v2Colors.onMidnight }]}>
          {busy ? "…" : label}
        </NativeText>
      </Pressable>
    </Animated.View>
  );
}

export function TextLink({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}>
      <NativeText style={[v2Type.caption, { color: disabled ? v2Colors.inkMuted : v2Colors.coral, textAlign: "center" }]}>{label}</NativeText>
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
        accessibilityLabel={label}
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

interface ChoiceRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessory?: React.ReactNode;
  disabled?: boolean;
}

export function RadioRow(props: ChoiceRowProps) {
  return <ChoiceRow {...props} role="radio" />;
}

export function CheckboxRow(props: ChoiceRowProps) {
  return <ChoiceRow {...props} role="checkbox" />;
}

/** Shared appearance, with the correct selection semantics for each form. */
function ChoiceRow({
  label,
  selected,
  onPress,
  accessory,
  role,
  disabled = false,
}: ChoiceRowProps & { role: "radio" | "checkbox" }) {
  const press = usePressScale();
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole={role}
        accessibilityLabel={label}
        accessibilityState={{ selected, checked: selected, disabled }}
        disabled={disabled}
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
          paddingVertical: v2Space.sm,
          borderCurve: "continuous",
          borderWidth: 1.5,
          borderColor: selected ? v2Colors.coral : v2Colors.border,
          backgroundColor: selected ? v2Colors.midnight : v2Colors.paper,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: v2Space.sm,
        }}
      >
        <NativeText style={[v2Type.chip, { flex: 1, color: selected ? v2Colors.onMidnight : disabled ? v2Colors.inkMuted : v2Colors.ink }]}>{label}</NativeText>
        {selected ? <NativeText accessible={false} style={[v2Type.chip, { color: v2Colors.onMidnight }]}>✓</NativeText> : null}
        {accessory}
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
  accessibilityLabel,
  accessibilityHint,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  keyboardType?: "default" | "numeric";
  returnKeyType?: "done" | "next";
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel ?? placeholder}
      accessibilityHint={accessibilityHint}
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

/** A typed draft is included by both Add and the screen's Continue action. */
export function includePendingTag(tags: string[], draft: string): string[] {
  const value = draft.trim();
  return value && !tags.includes(value) ? [...tags, value] : tags;
}

export function TagInput({ tags, onChange, draft, onDraftChange, placeholder, label }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  draft: string;
  onDraftChange: (draft: string) => void;
  placeholder: string;
  label: string;
}) {
  const commit = () => {
    onChange(includePendingTag(tags, draft));
    onDraftChange("");
  };
  return (
    <View style={{ gap: v2Space.sm }}>
      <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>{label}</NativeText>
      {tags.length > 0 ? (
        <ChipRow>
          {tags.map((tag) => (
            <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`Remove ${tag}`}
              onPress={() => onChange(tags.filter((value) => value !== tag))}
              style={{ minHeight: 44, paddingHorizontal: v2Space.md, justifyContent: "center",
                borderRadius: v2Radii.chip, backgroundColor: v2Colors.midnight }}>
              <NativeText style={[v2Type.chip, { color: v2Colors.onMidnight }]}>{tag} ×</NativeText>
            </Pressable>
          ))}
        </ChipRow>
      ) : null}
      <View style={{ flexDirection: "row", gap: v2Space.sm, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <TextField value={draft} onChangeText={onDraftChange} placeholder={placeholder}
            accessibilityLabel={label} onSubmitEditing={commit} />
        </View>
        <TextLink label="Add" onPress={commit} disabled={!draft.trim()} />
      </View>
    </View>
  );
}
