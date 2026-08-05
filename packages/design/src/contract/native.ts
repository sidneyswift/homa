import { DESIGN_CONTRACT_VERSION } from "./version.ts";
import { colorTokens, nativeTonalScale } from "./colors.ts";
import { fontRoles, typeRoles } from "./typography.ts";
import { approvedFontFamilies } from "./fonts.ts";
import { spacing, radii } from "./layout.ts";
import { motion } from "./motion.ts";

/** Versioned contract for the React Native adapter of Quiet authority. */
export const NATIVE_PROJECTION_SCHEMA_VERSION = 1 as const;

export const nativeTypeScale = {
  xs: 12,
  sm: typeRoles.bodySmall.size,
  base: typeRoles.body.size,
  lg: typeRoles.bodyLarge.size,
  xl: 22,
  xxl: 28,
  xxxl: 36,
} as const;

export const nativeElevation = {
  sm: {
    shadowColor: colorTokens.ink,
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: colorTokens.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

export const nativeThemeColors = {
  light: {
    page: colorTokens.canvas,
    card: colorTokens.paper,
    surfaceSunken: nativeTonalScale.neutral100,
    textStrong: nativeTonalScale.neutral900,
    textBody: nativeTonalScale.neutral800,
    textMuted: nativeTonalScale.neutral600,
    textSubtle: nativeTonalScale.neutral500,
    brand: nativeTonalScale.brand500,
    action: colorTokens.midnightAction,
    brandHover: nativeTonalScale.brand600,
    brandSoft: nativeTonalScale.brand50,
    onBrand: colorTokens.paper,
    constructive: nativeTonalScale.constructive500,
    constructiveSoft: nativeTonalScale.constructive50,
    highlight: nativeTonalScale.highlight500,
    highlightSoft: nativeTonalScale.highlight100,
    border: colorTokens.controlBoundary,
    borderSubtle: nativeTonalScale.neutral200,
    focusRing: colorTokens.visualCoral,
    success: nativeTonalScale.constructive600,
    danger: nativeTonalScale.error500,
    dangerSoft: nativeTonalScale.error100,
    info: nativeTonalScale.information500,
  },
  dark: {
    page: "#1E2936",
    card: "#27374D",
    surfaceRaised: "#33465E",
    surfaceSunken: "#17212C",
    textStrong: "#FFFEFC",
    textBody: "#F2EEE7",
    textMuted: "#C7C2BA",
    textSubtle: "#A9A39A",
    brand: colorTokens.visualCoral,
    action: colorTokens.midnightAction,
    brandHover: "#F0835A",
    brandSoft: "#573426",
    onBrand: "#FFFEFC",
    constructive: "#9BC5A8",
    constructiveSoft: "#294737",
    highlight: "#EBCF82",
    highlightSoft: "#51431F",
    border: "#53677D",
    borderSubtle: "#40546A",
    focusRing: "#F0835A",
    success: "#9BC5A8",
    danger: "#F2A296",
    dangerSoft: "#59332E",
    info: "#AFCED5",
  },
} as const;

export const nativePrimitiveRoles = [
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
] as const;

export type NativePrimitiveRole = (typeof nativePrimitiveRoles)[number];

export interface NativePrimitiveRequirement {
  requiredStates: readonly string[];
  accessibility: readonly string[];
}

const commonStates = [
  "rest",
  "pressed",
  "disabled",
  "loading",
  "error",
  "offline",
  "interrupted",
  "dynamic-type",
  "appearance",
  "reduced-motion",
  "increased-contrast",
  "localized-expansion",
] as const;

export const nativePrimitiveRequirements = {
  text: {
    requiredStates: ["rest", "dynamic-type", "localized-expansion"],
    accessibility: ["allowFontScaling", "no-essential-line-clamp"],
  },
  surface: {
    requiredStates: ["rest", "appearance", "increased-contrast"],
    accessibility: ["semantic-background-boundary", "no-color-only-state"],
  },
  action: {
    requiredStates: commonStates,
    accessibility: ["button-role", "44pt-target", "accessibilityState", "focus-visible-boundary"],
  },
  field: {
    requiredStates: [...commonStates, "keyboard"],
    accessibility: ["label-and-error", "allowFontScaling", "keyboard-reachable"],
  },
  choice: {
    requiredStates: [...commonStates, "selected"],
    accessibility: ["checkbox-radio-switch-role", "checked-state", "44pt-target"],
  },
  status: {
    requiredStates: ["loading", "success", "error", "offline", "interrupted", "localized-expansion"],
    accessibility: ["text-or-progressbar-role", "announcement-adapter", "not-color-only"],
  },
  identity: {
    requiredStates: ["rest", "appearance", "reduced-motion"],
    accessibility: ["real-logo-adapter", "descriptive-image-label"],
  },
  navigation: {
    requiredStates: ["rest", "pressed", "selected", "disabled", "dynamic-type", "safe-area"],
    accessibility: ["selected-state", "44pt-target", "safe-area-context"],
  },
  sheet: {
    requiredStates: ["rest", "loading", "error", "reduced-motion", "safe-area", "keyboard"],
    accessibility: ["modal-focus-lifecycle", "escape-dismiss", "safe-area-context", "reduced-motion-endpoint"],
  },
  feedback: {
    requiredStates: ["pressed", "success", "error", "offline", "interrupted", "reduced-motion"],
    accessibility: ["announcement-adapter", "haptic-role-is-explicit", "truthful-state-only"],
  },
  artifact: {
    requiredStates: ["rest", "pressed", "selected", "loading", "success", "error", "offline", "localized-expansion"],
    accessibility: ["title-and-status", "preview-is-decorative-when-labelled", "44pt-target"],
  },
} as const satisfies Record<NativePrimitiveRole, NativePrimitiveRequirement>;

export const nativePlatformContract = {
  target: { minimumHitTargetPt: 44, minimumIconPt: 24 },
  safeArea: {
    adapter: "react-native-safe-area-context",
    requiredEdges: ["top", "bottom"],
    sheetBottomPadding: "inset-aware",
  },
  dynamicType: {
    adapter: "React Native allowFontScaling",
    probe: "accessibility-extra-extra-extra-large",
    maxFontSizeMultiplier: null,
    clippingPolicy: "never-clip-essential-copy",
  },
  appearance: {
    adapter: "React Native useColorScheme",
    profiles: ["light", "dark"],
    adaptiveSurfaceRule: "select-a-complete-profile",
  },
  reducedMotion: {
    adapter: "react-native-reanimated useReducedMotion",
    endpoint: motion.reducedMotionEndpoint,
    loops: "live-state-only",
  },
  reducedTransparency: {
    adapter: "platform-preference-adapter",
    endpoint: "opaque-surface-with-preserved-hierarchy",
    proof: "manual-device-required",
  },
  increasedContrast: {
    adapter: "platform-preference-adapter",
    endpoint: "explicit-boundaries-and-approved-contrast-pairs",
    proof: "simulator-and-manual-device-required",
  },
  keyboard: {
    adapter: "KeyboardAvoidingView-or-scroll-container",
    endpoint: "focused-field-and-next-action-remain-reachable",
  },
  localization: {
    endpoint: "allow-copy-expansion-and-natural-wrapping",
    prohibited: ["essential-line-clamp", "fixed-width-label"],
  },
} as const;

export const nativeHapticRoles = {
  press: { platformEvent: "selection", truth: "direct manipulation was accepted" },
  select: { platformEvent: "selection", truth: "a choice changed" },
  success: { platformEvent: "notification-success", truth: "the server or device confirmed completion" },
  error: { platformEvent: "notification-error", truth: "a real failure needs attention" },
  warning: { platformEvent: "notification-warning", truth: "a meaningful risk or interruption is present" },
} as const;

export const nativeProjectionVerification = {
  staticContract: "required",
  renderedFixture: "required",
  simulator: "required",
  physicalDevice: "required",
  voiceOver: "physical-device-required",
  android: "compile-only-until-founder-ruling",
} as const;

export const NATIVE_PROJECTION_CONTRACT = {
  version: DESIGN_CONTRACT_VERSION,
  schemaVersion: NATIVE_PROJECTION_SCHEMA_VERSION,
  source: "@homa/design/contract",
  theme: {
    tonalScale: nativeTonalScale,
    colors: nativeThemeColors,
    typography: { fontRoles, typeRoles, typeScale: nativeTypeScale, families: approvedFontFamilies },
    spacing,
    radii,
    elevation: nativeElevation,
    motion,
  },
  primitiveRoles: nativePrimitiveRoles,
  primitiveRequirements: nativePrimitiveRequirements,
  platform: nativePlatformContract,
  haptics: nativeHapticRoles,
  verification: nativeProjectionVerification,
} as const;

export type NativeProjectionContract = typeof NATIVE_PROJECTION_CONTRACT;
