/**
 * Deterministic native evidence contract for gh#726.
 *
 * This file names the proof we need without pretending a source scan is a
 * VoiceOver session or an installed-build recording. The runner reports each
 * dimension separately, so an unavailable device remains visibly open.
 */

export const NATIVE_GAUNTLET_VERSION = "native-interface-gauntlet-v1" as const;

export type NativeGauntletProfileSupport =
  | "required"
  | "ruled-out"
  | "compile-only";

export type NativeGauntletDeviceKind = "iphone" | "ipad" | "android";

export interface NativeGauntletProfile {
  id: string;
  kind: NativeGauntletDeviceKind;
  support: NativeGauntletProfileSupport;
  orientation: "portrait" | "landscape";
  simulatorNames: readonly string[];
  runtimeFamilies: readonly string[];
  reason: string;
}

export const nativeGauntletProfiles: readonly NativeGauntletProfile[] = [
  {
    id: "iphone-oldest-supported",
    kind: "iphone",
    support: "required",
    orientation: "portrait",
    simulatorNames: ["iPhone 16e", "iPhone 16"],
    runtimeFamilies: ["iOS 18", "iOS 26"],
    reason: "Oldest supported iPhone profile proves the minimum product posture.",
  },
  {
    id: "iphone-current",
    kind: "iphone",
    support: "required",
    orientation: "portrait",
    simulatorNames: ["iPhone 17 Pro", "iPhone 17"],
    runtimeFamilies: ["iOS 26"],
    reason: "Current iPhone profile proves the primary installed experience.",
  },
  {
    id: "ipad-portrait-ruled",
    kind: "ipad",
    support: "ruled-out",
    orientation: "portrait",
    simulatorNames: ["iPad Pro 11-inch (M5)", "iPad Air 11-inch (M4)"],
    runtimeFamilies: ["iOS 26"],
    reason: "The current native contract sets supportsTablet to false.",
  },
  {
    id: "ipad-landscape-ruled",
    kind: "ipad",
    support: "ruled-out",
    orientation: "landscape",
    simulatorNames: ["iPad Pro 11-inch (M5)", "iPad Air 11-inch (M4)"],
    runtimeFamilies: ["iOS 26"],
    reason: "The ruled iPad posture includes landscape so it cannot ship silently.",
  },
  {
    id: "android-compile-guard",
    kind: "android",
    support: "compile-only",
    orientation: "portrait",
    simulatorNames: [],
    runtimeFamilies: [],
    reason: "Android is intentionally unreleased and must remain compile guarded.",
  },
] as const;

export type NativeGauntletSettingId =
  | "dynamic-type"
  | "voiceover"
  | "reduce-motion"
  | "reduce-transparency"
  | "increase-contrast"
  | "safe-area"
  | "keyboard"
  | "offline"
  | "interruption"
  | "background-foreground"
  | "deep-link"
  | "permissions";

export interface NativeGauntletSetting {
  id: NativeGauntletSettingId;
  label: string;
  proof: "static" | "simulator" | "physical-device";
  required: boolean;
  truthBoundary: string;
}

export const nativeGauntletSettings: readonly NativeGauntletSetting[] = [
  {
    id: "dynamic-type",
    label: "Dynamic Type and large text",
    proof: "simulator",
    required: true,
    truthBoundary: "Large text must reflow without clipped labels or hidden actions.",
  },
  {
    id: "voiceover",
    label: "VoiceOver labels and order",
    proof: "physical-device",
    required: true,
    truthBoundary: "Source labels are a prerequisite, not proof of a real spoken traversal.",
  },
  {
    id: "reduce-motion",
    label: "Reduce Motion endpoint",
    proof: "simulator",
    required: true,
    truthBoundary: "Meaning remains while nonessential movement is removed.",
  },
  {
    id: "reduce-transparency",
    label: "Reduce Transparency endpoint",
    proof: "simulator",
    required: true,
    truthBoundary: "Sheets and overlays retain hierarchy when translucency is reduced.",
  },
  {
    id: "increase-contrast",
    label: "Increase Contrast endpoint",
    proof: "simulator",
    required: true,
    truthBoundary: "Selection, focus, status, and action boundaries remain visible.",
  },
  {
    id: "safe-area",
    label: "Safe-area edges",
    proof: "simulator",
    required: true,
    truthBoundary: "Top bars, Voice lane, sheets, and keyboard content avoid system insets.",
  },
  {
    id: "keyboard",
    label: "Keyboard and focus",
    proof: "simulator",
    required: true,
    truthBoundary: "Fields and the next useful action remain reachable above the keyboard.",
  },
  {
    id: "offline",
    label: "Offline and recovery",
    proof: "simulator",
    required: true,
    truthBoundary: "The app names the unavailable operation and preserves retry or recovery.",
  },
  {
    id: "interruption",
    label: "Interruption and resume",
    proof: "physical-device",
    required: true,
    truthBoundary: "Voice and recording states never imply completion after interruption.",
  },
  {
    id: "background-foreground",
    label: "Background and foreground",
    proof: "simulator",
    required: true,
    truthBoundary: "Returning to the app preserves truthful session and recovery state.",
  },
  {
    id: "deep-link",
    label: "Deep-link entry and return",
    proof: "simulator",
    required: true,
    truthBoundary: "Auth and external handoffs return to a named, safe destination.",
  },
  {
    id: "permissions",
    label: "Permission denial and settings return",
    proof: "physical-device",
    required: true,
    truthBoundary: "Microphone, calendar, and camera permission failures remain recoverable.",
  },
] as const;

export interface NativeGauntletStateScenario {
  id: string;
  setting: NativeGauntletSettingId;
  surfaces: readonly string[];
  requiredMarkers: readonly string[];
}

export const nativeGauntletStateScenarios: readonly NativeGauntletStateScenario[] = [
  {
    id: "voiceover-priority-order",
    setting: "voiceover",
    surfaces: ["signin", "voice", "progress", "planner", "settings"],
    requiredMarkers: ["accessibilityRole", "accessibilityLabel", "accessibilityState"],
  },
  {
    id: "large-text-reflow",
    setting: "dynamic-type",
    surfaces: ["chat", "planner", "binder", "settings"],
    requiredMarkers: ["fontScale", "useWindowDimensions"],
  },
  {
    id: "motion-and-transparency",
    setting: "reduce-motion",
    surfaces: ["drawer", "modal", "voice"],
    requiredMarkers: ["useReducedMotion", "animationType"],
  },
  {
    id: "contrast-and-boundaries",
    setting: "increase-contrast",
    surfaces: ["theme", "shared-primitives"],
    requiredMarkers: ["contrastRatio", "controlBoundary"],
  },
  {
    id: "safe-area-and-keyboard",
    setting: "safe-area",
    surfaces: ["signin", "chat", "lesson-recorder", "voice"],
    requiredMarkers: ["SafeAreaView", "KeyboardAvoidingView", "keyboardShouldPersistTaps"],
  },
  {
    id: "offline-recovery",
    setting: "offline",
    surfaces: ["bootstrap", "progress", "chat", "share"],
    requiredMarkers: ["expo-network", "offline", "recovery"],
  },
  {
    id: "interruption-resume",
    setting: "interruption",
    surfaces: ["voice", "lesson-recorder", "billing"],
    requiredMarkers: ["AppState.addEventListener", "interrupted"],
  },
  {
    id: "deep-link-and-permission-return",
    setting: "deep-link",
    surfaces: ["auth", "web-links", "lesson-recorder", "calendar"],
    requiredMarkers: ["homa://", "Linking", "openSettings"],
  },
] as const;

export const nativeGauntletSourceRoots = [
  "apps/mobile/src/app",
  "apps/mobile/src/components",
  "apps/mobile/src/features",
  "apps/mobile/src/lib",
  "apps/mobile/src/theme",
] as const;
