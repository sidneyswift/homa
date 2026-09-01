import { useEffect, useState, type ReactNode, type RefObject } from "react";
import {
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type AccessibilityState,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";

import { Logo } from "../brand/logo";
import { AccessibleModal } from "./accessible-modal";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { nativeHapticRoles, type NativePrimitiveRole } from "@homa/design/contract";
import { fontFamilies } from "../../theme/fonts";
import {
  darkQuietColors as darkColors,
  quietColors as colors,
  quietPressScale as pressScale,
  quietRadii,
  quietSpace,
  quietTypeRoles,
  quietTypeScale as fontSize,
} from "../../theme/tokens";

const space = {
  xs: quietSpace.scale[1],
  sm: quietSpace.scale[2],
  md: quietSpace.scale[4],
  lg: quietSpace.scale[6],
} as const;

const radius = {
  control: quietRadii.control,
  card: quietRadii.card,
} as const;

/** The role names are deliberately exported for static primitive coverage checks. */
export const nativePrimitiveRoleNames: readonly NativePrimitiveRole[] = [
  "text",
  "surface",
  "action",
  "field",
  "choice",
  "status",
  "identity",
  "navigation",
  "sheet",
  "feedback",
  "artifact",
];

type TextRole = "body" | "bodyLarge" | "bodySmall" | "caption" | "label" | "eyebrow" | "control" | "metric" | "display";
type TextTone = "strong" | "body" | "muted" | "subtle" | "inverse";

const TEXT_STYLES: Record<TextRole, TextStyle> = {
  body: { fontFamily: fontFamilies.body, fontSize: quietTypeRoles.body.size, lineHeight: quietTypeRoles.body.lineHeight },
  bodyLarge: { fontFamily: fontFamilies.body, fontSize: quietTypeRoles.bodyLarge.size, lineHeight: quietTypeRoles.bodyLarge.lineHeight },
  bodySmall: { fontFamily: fontFamilies.body, fontSize: quietTypeRoles.bodySmall.size, lineHeight: quietTypeRoles.bodySmall.lineHeight },
  caption: { fontFamily: fontFamilies.bodyMedium, fontSize: quietTypeRoles.caption.size, lineHeight: quietTypeRoles.caption.lineHeight },
  label: { fontFamily: fontFamilies.bodySemibold, fontSize: quietTypeRoles.label.size, lineHeight: quietTypeRoles.label.lineHeight },
  eyebrow: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: quietTypeRoles.eyebrow.size,
    lineHeight: quietTypeRoles.eyebrow.lineHeight,
    letterSpacing: quietTypeRoles.eyebrow.size * 0.08,
    textTransform: "uppercase",
  },
  control: {
    fontFamily: fontFamilies.bodySemibold,
    fontSize: quietTypeRoles.control.size,
    lineHeight: quietTypeRoles.control.lineHeight,
  },
  metric: {
    fontFamily: fontFamilies.bodySemibold,
    fontSize: quietTypeRoles.metric.minSize,
    lineHeight: quietTypeRoles.metric.lineHeight,
    fontVariant: ["tabular-nums"],
  },
  display: { fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.xxl, lineHeight: 32 },
};

function textColor(tone: TextTone, appearance: "light" | "dark"): string {
  const theme = appearance === "dark" ? darkColors : colors;
  if (tone === "strong") return theme.textStrong;
  if (tone === "muted") return theme.textMuted;
  if (tone === "subtle") return theme.textSubtle;
  if (tone === "inverse") return theme.onBrand;
  return theme.textBody;
}

export function NativeText({
  appearance = "light",
  children,
  role = "body",
  tone = "body",
  style,
  ...props
}: Omit<TextProps, "children" | "style" | "role"> & {
  appearance?: "light" | "dark";
  children: ReactNode;
  role?: TextRole;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  return (
    <Text
      {...props}
      style={[
        TEXT_STYLES[role],
        { color: textColor(tone, appearance) },
        style,
        fontScale >= 2 ? { lineHeight: undefined } : null,
      ]}
    >
      {children}
    </Text>
  );
}

export function NativeHeading({
  children,
  appearance = "light",
  level = 2,
  style,
  ...props
}: Omit<TextProps, "children" | "style" | "accessibilityRole" | "role"> & {
  children: ReactNode;
  appearance?: "light" | "dark";
  level?: 1 | 2 | 3;
  style?: StyleProp<TextStyle>;
}) {
  const headingSize = level === 1 ? fontSize.xxxl : level === 2 ? fontSize.xxl : fontSize.xl;
  const headingLineHeight = level === 1 ? 40 : level === 2 ? 32 : 28;
  return (
    <NativeText
      {...props}
      appearance={appearance}
      role="display"
      tone="strong"
      accessibilityRole="header"
      style={[{ fontSize: headingSize, lineHeight: headingLineHeight }, style]}
    >
      {children}
    </NativeText>
  );
}

export function NativeEyebrow({
  children,
  appearance = "light",
  style,
  ...props
}: Omit<TextProps, "children" | "style" | "role"> & {
  children: ReactNode;
  appearance?: "light" | "dark";
  style?: StyleProp<TextStyle>;
}) {
  return (
    <NativeText
      {...props}
      appearance={appearance}
      role="eyebrow"
      tone="muted"
      style={style}
    >
      {children}
    </NativeText>
  );
}

type SurfaceVariant = "page" | "paper" | "sunken" | "raised" | "transparent";

export function NativeSurface({
  appearance = "light",
  children,
  variant = "paper",
  style,
  ...props
}: Omit<ViewProps, "style"> & {
  appearance?: "light" | "dark";
  children: ReactNode;
  variant?: SurfaceVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = appearance === "dark" ? darkColors : colors;
  const backgroundColor = variant === "page"
    ? theme.page
    : variant === "sunken"
      ? theme.surfaceSunken
      : variant === "raised"
        ? theme.surfaceRaised
        : variant === "transparent"
          ? "transparent"
          : theme.card;
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor,
          borderRadius: radius.card,
          borderWidth: variant === "transparent" ? 0 : 1,
          borderColor: appearance === "dark" ? darkColors.borderSubtle : colors.borderSubtle,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type NativeActionVariant = "primary" | "secondary" | "quiet" | "destructive";
export type NativeActionSize = "sm" | "md" | "lg";

const NATIVE_ACTION_SIZE_STYLES: Record<
  NativeActionSize,
  { minHeight: number; paddingHorizontal: number; paddingVertical: number; textSize: number }
> = {
  sm: { minHeight: 44, paddingHorizontal: space.md, paddingVertical: space.sm, textSize: quietTypeRoles.control.minimumSize },
  md: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, textSize: quietTypeRoles.control.size },
  lg: { minHeight: 52, paddingHorizontal: space.lg, paddingVertical: 14, textSize: quietTypeRoles.control.size },
};

export function NativeAction({
  accessibilityHint,
  accessibilityState,
  appearance = "light",
  busy = false,
  disabled = false,
  icon,
  label,
  onPress,
  size = "md",
  style,
  variant = "primary",
  ...rest
}: Omit<PressableProps, "children" | "style" | "onPress" | "disabled"> & {
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  appearance?: "light" | "dark";
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onPress: () => void;
  size?: NativeActionSize;
  style?: StyleProp<ViewStyle>;
  variant?: NativeActionVariant;
}) {
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const theme = appearance === "dark" ? darkColors : colors;
  const look = variant === "primary"
    ? { backgroundColor: theme.action, borderColor: theme.action, text: theme.actionText }
    : variant === "destructive"
      ? { backgroundColor: theme.danger, borderColor: theme.danger, text: theme.dangerText }
      : variant === "quiet"
        ? { backgroundColor: "transparent", borderColor: "transparent", text: theme.brandText }
        : { backgroundColor: theme.card, borderColor: theme.border, text: theme.textStrong };
  const unavailable = disabled || busy;
  // A waiting (disabled) control stays inside the palette: page fill,
  // quiet border, muted label. Dimming the action ink over cream
  // produced an off-palette gray slab that read as broken, and it was
  // the largest element on several onboarding screens (gauntlet round
  // 1, 2026-08-21). Busy keeps its live look; work is happening.
  const resting =
    disabled && !busy
      ? { backgroundColor: theme.page, borderColor: theme.textMuted, text: theme.textMuted }
      : look;
  const sizeStyle = NATIVE_ACTION_SIZE_STYLES[size];
  const stacksIconAboveLabel = Boolean(icon) && fontScale >= 2;
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled: unavailable, busy }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: sizeStyle.minHeight,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: resting.borderColor,
          backgroundColor: resting.backgroundColor,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
          alignItems: "center",
          justifyContent: "center",
          opacity: busy ? 0.55 : 1,
          transform: reducedMotion ? undefined : [{ scale: pressed ? pressScale : 1 }],
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: stacksIconAboveLabel ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 1,
          maxWidth: "100%",
          width: stacksIconAboveLabel ? "100%" : undefined,
          gap: stacksIconAboveLabel ? space.xs : space.sm,
        }}
      >
        {icon}
        <NativeText
          role="control"
          tone="inverse"
          style={{
            color: resting.text,
            textAlign: "center",
            flexShrink: 1,
            width: stacksIconAboveLabel ? "100%" : undefined,
            fontSize: sizeStyle.textSize,
          }}
        >
          {label}
        </NativeText>
      </View>
    </Pressable>
  );
}

export function NativeField({
  appearance = "light",
  containerStyle,
  error,
  hint,
  label,
  accessibilityLabel,
  onBlur,
  onFocus,
  style,
  ...props
}: Omit<TextInputProps, "style"> & {
  appearance?: "light" | "dark";
  containerStyle?: StyleProp<ViewStyle>;
  error?: string;
  hint?: string;
  label: string;
  style?: StyleProp<TextStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const theme = appearance === "dark" ? darkColors : colors;
  return (
    <View style={[{ gap: space.xs }, containerStyle]}>
      <NativeText role="label" tone="strong" appearance={appearance}>{label}</NativeText>
      {hint ? <NativeText role="caption" tone="muted" appearance={appearance}>{hint}</NativeText> : null}
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{
          ...props.accessibilityState,
          disabled: props.accessibilityState?.disabled === true || props.editable === false,
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={theme.textMuted}
        style={[
          {
            minHeight: 48,
            borderRadius: radius.control,
            borderWidth: focused ? 2 : 1,
            borderColor: focused ? theme.focusRing : theme.border,
            backgroundColor: theme.card,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            color: theme.textStrong,
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            lineHeight: 24,
          },
          style,
        ]}
      />
      {error ? <NativeStatus tone="error" label={error} appearance={appearance} announce /> : null}
    </View>
  );
}

export function NativeChoice({
  appearance = "light",
  children,
  disabled = false,
  label,
  onPress,
  role = "checkbox",
  selected,
  style,
}: {
  appearance?: "light" | "dark";
  children?: ReactNode;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  role?: "checkbox" | "radio" | "switch";
  selected: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = appearance === "dark" ? darkColors : colors;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          borderRadius: radius.control,
          paddingHorizontal: space.sm,
          opacity: disabled ? 0.55 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <View style={{ width: 22, height: 22, borderRadius: role === "radio" ? 11 : 5, borderWidth: 2, borderColor: selected ? theme.action : theme.border, alignItems: "center", justifyContent: "center" }}>
        {selected ? <View style={{ width: 10, height: 10, borderRadius: role === "radio" ? 5 : 2, backgroundColor: theme.action }} /> : null}
      </View>
      <NativeText tone="body" appearance={appearance} style={{ flex: 1 }}>{children ?? label}</NativeText>
    </Pressable>
  );
}

type StatusTone = "info" | "constructive" | "attention" | "error" | "offline";

export function NativeStatus({
  announce = false,
  appearance = "light",
  detail,
  label,
  occurrenceId,
  style,
  tone = "info",
}: {
  announce?: boolean;
  appearance?: "light" | "dark";
  detail?: string;
  label: string;
  occurrenceId?: string | number;
  style?: StyleProp<ViewStyle>;
  tone?: StatusTone;
}) {
  const theme = appearance === "dark" ? darkColors : colors;
  const paletteForTone = tone === "constructive"
    ? { ink: theme.constructive, tint: theme.constructiveSoft }
    : tone === "attention"
      ? { ink: theme.highlight, tint: theme.highlightSoft }
      : tone === "error"
        ? { ink: theme.danger, tint: theme.dangerSoft }
        : tone === "offline"
          ? { ink: theme.info, tint: appearance === "dark" ? darkColors.surfaceSunken : theme.surfaceSunken }
          : { ink: theme.info, tint: appearance === "dark" ? darkColors.surfaceSunken : theme.surfaceSunken };
  useAccessibilityAnnouncement(announce ? label : null, occurrenceId);
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={[{ minHeight: 44, borderRadius: radius.control, borderWidth: 1, borderColor: paletteForTone.ink, backgroundColor: paletteForTone.tint, padding: space.sm, gap: 2 }, style]}>
      <NativeText role="label" tone="strong" appearance={appearance}>{label}</NativeText>
      {detail ? <NativeText role="bodySmall" tone="body" appearance={appearance}>{detail}</NativeText> : null}
    </View>
  );
}

export function NativeIdentity({
  label = "Homa",
  size = 32,
  tone = "light",
  variant = "full",
}: {
  label?: string;
  size?: number;
  tone?: "light" | "dark";
  variant?: "full" | "mark";
}) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Logo size={size} tone={tone} variant={variant} />
      </View>
    </View>
  );
}

export function NativeNavigation({
  appearance = "light",
  icon,
  label,
  onPress,
  selected = false,
  style,
}: {
  appearance?: "light" | "dark";
  icon?: ReactNode;
  label: string;
  onPress: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = appearance === "dark" ? darkColors : colors;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.control, paddingHorizontal: space.sm, backgroundColor: selected ? theme.brandSoft : "transparent", opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {icon}
      <NativeText role="label" tone={selected ? "strong" : "muted"} appearance={appearance} style={{ flexShrink: 1 }}>{label}</NativeText>
    </Pressable>
  );
}

export function NativeSheet({
  children,
  initialFocusRef,
  onDismiss,
  onRequestClose,
  returnFocusRef,
  title,
  visible,
}: {
  children: ReactNode;
  initialFocusRef: RefObject<View | null>;
  onDismiss?: () => void;
  onRequestClose?: () => void;
  returnFocusRef?: RefObject<View | null>;
  title: string;
  visible: boolean;
}) {
  return (
    <AccessibleModal
      visible={visible}
      title={title}
      initialFocusRef={initialFocusRef}
      returnFocusRef={returnFocusRef}
      onDismiss={onDismiss}
      onRequestClose={onRequestClose}
    >
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.page }}>
        {children}
      </SafeAreaView>
    </AccessibleModal>
  );
}

export function NativeFeedback({
  appearance = "light",
  haptic,
  label,
  occurrenceId,
  onHaptic,
  tone = "info",
}: {
  appearance?: "light" | "dark";
  haptic?: keyof typeof nativeHapticRoles;
  label: string;
  occurrenceId?: string | number;
  onHaptic?: (role: keyof typeof nativeHapticRoles) => void;
  tone?: StatusTone;
}) {
  useAccessibilityAnnouncement(label, occurrenceId);
  useEffect(() => {
    if (haptic && onHaptic) onHaptic(haptic);
  }, [haptic, onHaptic, occurrenceId]);
  return <NativeStatus label={label} tone={tone} appearance={appearance} />;
}

export function NativeArtifact({
  appearance = "light",
  children,
  kind = "artifact",
  label,
  onPress,
  status,
  style,
}: {
  appearance?: "light" | "dark";
  children?: ReactNode;
  kind?: string;
  label: string;
  onPress?: () => void;
  status?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <NativeSurface appearance={appearance} variant="paper" style={[{ padding: space.md, gap: space.sm }, style]}>
      <NativeEyebrow appearance={appearance}>{kind}</NativeEyebrow>
      <NativeHeading appearance={appearance} level={3}>{label}</NativeHeading>
      {status ? <NativeText role="caption" tone="muted" appearance={appearance}>{status}</NativeText> : null}
      {children}
    </NativeSurface>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: false }} onPress={onPress} style={{ minHeight: 44 }}>
      {content}
    </Pressable>
  );
}
