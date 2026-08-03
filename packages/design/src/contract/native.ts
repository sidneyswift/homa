import { DESIGN_CONTRACT_VERSION } from "./version.ts";
import { colorTokens, nativeColorScale } from "./colors.ts";
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
    surfaceSunken: nativeColorScale.stone100,
    textStrong: nativeColorScale.stone900,
    textBody: nativeColorScale.stone800,
    textMuted: nativeColorScale.stone600,
    textSubtle: nativeColorScale.stone500,
    brand: nativeColorScale.clay500,
    action: colorTokens.midnightAction,
    brandHover: nativeColorScale.clay600,
    brandSoft: nativeColorScale.clay50,
    onBrand: colorTokens.paper,
    sage: nativeColorScale.sage500,
    sageSoft: nativeColorScale.sage50,
    gold: nativeColorScale.gold500,
    goldSoft: nativeColorScale.gold100,
    border: colorTokens.controlBoundary,
    borderSubtle: nativeColorScale.stone200,
    focusRing: colorTokens.visualCoral,
    success: nativeColorScale.sage600,
    danger: nativeColorScale.rose500,
    dangerSoft: nativeColorScale.rose100,
    info: nativeColorScale.sky500,
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
    sage: "#9BC5A8",
    sageSoft: "#294737",
    gold: "#EBCF82",
    goldSoft: "#51431F",
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
export type NativePrimitiveDisposition = "new-primitive" | "wrap-existing" | "route-adapter";

export interface NativePrimitiveAdapter {
  component: string;
  source: string;
  disposition: NativePrimitiveDisposition;
  legacyComponents: readonly string[];
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

export const nativePrimitiveAdapters = {
  text: {
    component: "NativeText",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "new-primitive",
    legacyComponents: ["react-native/Text", "route-local text styles"],
    requiredStates: ["rest", "dynamic-type", "localized-expansion"],
    accessibility: ["allowFontScaling", "no-essential-line-clamp"],
  },
  surface: {
    component: "NativeSurface",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "new-primitive",
    legacyComponents: ["Card", "route-local View surfaces"],
    requiredStates: ["rest", "appearance", "increased-contrast"],
    accessibility: ["semantic-background-boundary", "no-color-only-state"],
  },
  action: {
    component: "NativeAction",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "wrap-existing",
    legacyComponents: ["Button", "IconButton", "route-local Pressable"],
    requiredStates: commonStates,
    accessibility: ["button-role", "44pt-target", "accessibilityState", "focus-visible-boundary"],
  },
  field: {
    component: "NativeField",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "wrap-existing",
    legacyComponents: ["TextField", "route-local TextInput"],
    requiredStates: [...commonStates, "keyboard"],
    accessibility: ["label-and-error", "allowFontScaling", "keyboard-reachable"],
  },
  choice: {
    component: "NativeChoice",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "new-primitive",
    legacyComponents: ["route-local radio", "route-local checkbox", "route-local Switch"],
    requiredStates: [...commonStates, "selected"],
    accessibility: ["checkbox-radio-switch-role", "checked-state", "44pt-target"],
  },
  status: {
    component: "NativeStatus",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "wrap-existing",
    legacyComponents: ["InlineError", "LoadingStatus", "route-local status rows"],
    requiredStates: ["loading", "success", "error", "offline", "interrupted", "localized-expansion"],
    accessibility: ["text-or-progressbar-role", "announcement-adapter", "not-color-only"],
  },
  identity: {
    component: "NativeIdentity",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "wrap-existing",
    legacyComponents: ["Logo", "Homa character adapters"],
    requiredStates: ["rest", "appearance", "reduced-motion"],
    accessibility: ["real-logo-adapter", "descriptive-image-label"],
  },
  navigation: {
    component: "NativeNavigation",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "new-primitive",
    legacyComponents: ["SidebarNav", "AppDrawer", "route-local navigation Pressable"],
    requiredStates: ["rest", "pressed", "selected", "disabled", "dynamic-type", "safe-area"],
    accessibility: ["selected-state", "44pt-target", "safe-area-context"],
  },
  sheet: {
    component: "NativeSheet",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "wrap-existing",
    legacyComponents: ["AccessibleModal", "route-local Modal"],
    requiredStates: ["rest", "loading", "error", "reduced-motion", "safe-area", "keyboard"],
    accessibility: ["modal-focus-lifecycle", "escape-dismiss", "safe-area-context", "reduced-motion-endpoint"],
  },
  feedback: {
    component: "NativeFeedback",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "new-primitive",
    legacyComponents: ["useAccessibilityAnnouncement", "route-local completion cues"],
    requiredStates: ["pressed", "success", "error", "offline", "interrupted", "reduced-motion"],
    accessibility: ["announcement-adapter", "haptic-role-is-explicit", "truthful-state-only"],
  },
  artifact: {
    component: "NativeArtifact",
    source: "apps/mobile/src/components/ui/semantic.tsx",
    disposition: "new-primitive",
    legacyComponents: ["material cards", "report previews", "route-local artifact rows"],
    requiredStates: ["rest", "pressed", "selected", "loading", "success", "error", "offline", "localized-expansion"],
    accessibility: ["title-and-status", "preview-is-decorative-when-labelled", "44pt-target"],
  },
} as const satisfies Record<NativePrimitiveRole, NativePrimitiveAdapter>;

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
    palette: nativeColorScale,
    colors: nativeThemeColors,
    typography: { fontRoles, typeRoles, typeScale: nativeTypeScale, families: approvedFontFamilies },
    spacing,
    radii,
    elevation: nativeElevation,
    motion,
  },
  primitiveRoles: nativePrimitiveRoles,
  primitiveAdapters: nativePrimitiveAdapters,
  platform: nativePlatformContract,
  haptics: nativeHapticRoles,
  verification: nativeProjectionVerification,
} as const;

export type NativeProjectionContract = typeof NATIVE_PROJECTION_CONTRACT;
