/**
 * Deterministic native evidence contract for gh#726.
 *
 * This file names the proof we need without pretending a source scan is a
 * VoiceOver session or an installed-build recording. The runner reports each
 * dimension separately, so an unavailable device remains visibly open.
 */

export const NATIVE_GAUNTLET_VERSION = "native-interface-gauntlet-v3" as const;

/**
 * Homa's installed native modules declare iOS 16.4, and the app is built on
 * Expo SDK 56. An "oldest supported" run must exercise that effective build
 * floor on hardware from the oldest iPhone class that can run it, not a
 * convenient current phone.
 */
export const nativeIosSupportPolicy = {
  expoSdkMajor: 56,
  minimumOperatingSystem: {
    major: 16,
    minor: 4,
    label: "iOS 16.4",
  },
  hardware: {
    kind: "iphone",
    floor: "iPhone 8 class",
    oldestValidationDevices: ["iPhone 8", "iPhone 8 Plus", "iPhone X"],
  },
  supportsTablet: false,
  orientation: "portrait",
  source: "apps/mobile/package.json plus both installed native-module podspec platform floors",
} as const;

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
  runtimeConstraint:
    | { kind: "exact"; major: number; minor: number }
    | { kind: "minimum"; major: number; minor: number }
    | { kind: "none" };
  reason: string;
}

export const nativeGauntletProfiles: readonly NativeGauntletProfile[] = [
  {
    id: "iphone-ios-16-4-floor",
    kind: "iphone",
    support: "required",
    orientation: "portrait",
    simulatorNames: nativeIosSupportPolicy.hardware.oldestValidationDevices,
    runtimeConstraint: { kind: "exact", major: 16, minor: 4 },
    reason: "This distinct floor profile certifies Homa on exactly iOS 16.4 and the oldest supported iPhone hardware class.",
  },
  {
    id: "iphone-current",
    kind: "iphone",
    support: "required",
    orientation: "portrait",
    simulatorNames: ["iPhone 17 Pro", "iPhone 17"],
    runtimeConstraint: { kind: "minimum", major: 16, minor: 4 },
    reason: "Current iPhone profile proves the primary installed experience.",
  },
  {
    id: "ipad-portrait-ruled",
    kind: "ipad",
    support: "ruled-out",
    orientation: "portrait",
    simulatorNames: ["iPad Pro 11-inch (M5)", "iPad Air 11-inch (M4)"],
    runtimeConstraint: { kind: "minimum", major: 16, minor: 4 },
    reason: "The current native contract sets supportsTablet to false.",
  },
  {
    id: "ipad-landscape-ruled",
    kind: "ipad",
    support: "ruled-out",
    orientation: "landscape",
    simulatorNames: ["iPad Pro 11-inch (M5)", "iPad Air 11-inch (M4)"],
    runtimeConstraint: { kind: "minimum", major: 16, minor: 4 },
    reason: "The ruled iPad posture includes landscape so it cannot ship silently.",
  },
  {
    id: "android-compile-guard",
    kind: "android",
    support: "compile-only",
    orientation: "portrait",
    simulatorNames: [],
    runtimeConstraint: { kind: "none" },
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
  proof: "simulator-manual" | "physical-device-manual";
  required: boolean;
  truthBoundary: string;
}

export const nativeGauntletSettings: readonly NativeGauntletSetting[] = [
  {
    id: "dynamic-type",
    label: "Dynamic Type and large text",
    proof: "simulator-manual",
    required: true,
    truthBoundary: "Large text must reflow without clipped labels or hidden actions.",
  },
  {
    id: "voiceover",
    label: "VoiceOver labels and order",
    proof: "physical-device-manual",
    required: true,
    truthBoundary: "Source labels are a prerequisite, not proof of a real spoken traversal.",
  },
  {
    id: "reduce-motion",
    label: "Reduce Motion endpoint",
    proof: "simulator-manual",
    required: true,
    truthBoundary: "Meaning remains while nonessential movement is removed.",
  },
  {
    id: "reduce-transparency",
    label: "Reduce Transparency endpoint",
    proof: "simulator-manual",
    required: true,
    truthBoundary: "Sheets and overlays retain hierarchy when translucency is reduced.",
  },
  {
    id: "increase-contrast",
    label: "Increase Contrast endpoint",
    proof: "simulator-manual",
    required: true,
    truthBoundary: "Selection, focus, status, and action boundaries remain visible.",
  },
  {
    id: "safe-area",
    label: "Safe-area edges",
    proof: "simulator-manual",
    required: true,
    truthBoundary: "Top bars, Voice lane, sheets, and keyboard content avoid system insets.",
  },
  {
    id: "keyboard",
    label: "Keyboard and focus",
    proof: "simulator-manual",
    required: true,
    truthBoundary: "Fields and the next useful action remain reachable above the keyboard.",
  },
  {
    id: "offline",
    label: "Offline and recovery",
    proof: "physical-device-manual",
    required: true,
    truthBoundary: "The app names the unavailable operation and preserves retry or recovery.",
  },
  {
    id: "interruption",
    label: "Interruption and resume",
    proof: "physical-device-manual",
    required: true,
    truthBoundary: "Voice and recording states never imply completion after interruption.",
  },
  {
    id: "background-foreground",
    label: "Background and foreground",
    proof: "physical-device-manual",
    required: true,
    truthBoundary: "Returning to the app preserves truthful session and recovery state.",
  },
  {
    id: "deep-link",
    label: "Deep-link entry and return",
    proof: "simulator-manual",
    required: true,
    truthBoundary: "Auth and external handoffs return to a named, safe destination.",
  },
  {
    id: "permissions",
    label: "Permission denial and settings return",
    proof: "physical-device-manual",
    required: true,
    truthBoundary: "Microphone, calendar, and camera permission failures remain recoverable.",
  },
] as const;

export const nativeRequiredProofBySetting: Readonly<
  Record<NativeGauntletSettingId, NativeGauntletSetting["proof"]>
> = {
  "dynamic-type": "simulator-manual",
  voiceover: "physical-device-manual",
  "reduce-motion": "simulator-manual",
  "reduce-transparency": "simulator-manual",
  "increase-contrast": "simulator-manual",
  "safe-area": "simulator-manual",
  keyboard: "simulator-manual",
  offline: "physical-device-manual",
  interruption: "physical-device-manual",
  "background-foreground": "physical-device-manual",
  "deep-link": "simulator-manual",
  permissions: "physical-device-manual",
};

export const nativePhysicalOnlySettingIds = [
  "voiceover",
  "offline",
  "interruption",
  "background-foreground",
  "permissions",
] as const satisfies readonly NativeGauntletSettingId[];

/**
 * Scenario markers are read only from these exact files. This prevents a
 * fixture, lab, or unrelated adapter from making a named product surface look
 * covered merely because it happens to contain the same source token.
 */
export const nativeGauntletSurfaceFileGroups = {
  signin: [
    "apps/mobile/src/app/(auth)/signin.tsx",
  ],
  voice: [
    "apps/mobile/src/features/voice/aura.tsx",
    "apps/mobile/src/features/voice/overlay-host.tsx",
    "apps/mobile/src/features/voice/use-voice-session.ts",
    "apps/mobile/src/features/voice/voice-dock.tsx",
    "apps/mobile/src/features/voice/voice-prompt-starters.tsx",
    "apps/mobile/src/features/voice/voice-screen.tsx",
  ],
  progress: [
    "apps/mobile/src/app/(tabs)/progress.tsx",
    "apps/mobile/src/features/progress/kid-switcher.tsx",
    "apps/mobile/src/features/progress/progress-error-model.ts",
    "apps/mobile/src/features/progress/progress-next-move-card.tsx",
    "apps/mobile/src/features/progress/subject-card.tsx",
    "apps/mobile/src/features/progress/use-progress-next-move.ts",
  ],
  planner: [
    "apps/mobile/src/app/(tabs)/planner.tsx",
    "apps/mobile/src/features/planner/event-composer.tsx",
    "apps/mobile/src/features/planner/month-view.tsx",
    "apps/mobile/src/features/planner/unscheduled-tray.tsx",
  ],
  settings: [
    "apps/mobile/src/app/settings.tsx",
    "apps/mobile/src/app/settings/delete-account.tsx",
  ],
  chat: [
    "apps/mobile/src/app/(tabs)/chat.tsx",
    "apps/mobile/src/features/chat/chat-session.tsx",
    "apps/mobile/src/features/chat/message-view.tsx",
  ],
  binder: [
    "apps/mobile/src/app/(tabs)/binder.tsx",
    "apps/mobile/src/features/binder/material-detail-modal.tsx",
    "apps/mobile/src/features/binder/material-grid-card.tsx",
  ],
  drawer: [
    "apps/mobile/src/components/nav/app-drawer.tsx",
  ],
  modal: [
    "apps/mobile/src/components/ui/accessible-modal.tsx",
  ],
  theme: [
    "apps/mobile/src/theme/accessibility-contrast.test.ts",
    "apps/mobile/src/theme/native-projection.ts",
    "apps/mobile/src/theme/tokens.ts",
  ],
  "shared-primitives": [
    "apps/mobile/src/components/ui/accessible-modal.tsx",
    "apps/mobile/src/components/ui/button.tsx",
    "apps/mobile/src/components/ui/card.tsx",
    "apps/mobile/src/components/ui/icon-button.tsx",
    "apps/mobile/src/components/ui/semantic.tsx",
    "apps/mobile/src/components/ui/text-field.tsx",
  ],
  "lesson-recorder": [
    "apps/mobile/src/features/lessons/native-lesson-recorder.tsx",
  ],
  bootstrap: [
    "apps/mobile/src/features/bootstrap/bootstrap.ts",
    "apps/mobile/src/features/bootstrap/mobile-bootstrap.ts",
  ],
  share: [
    "apps/mobile/src/features/materials/material-share-composer.tsx",
    "apps/mobile/src/features/materials/material-share-contract.ts",
    "apps/mobile/src/features/materials/material-share.ts",
  ],
  billing: [
    "apps/mobile/src/components/billing-gate.tsx",
    "apps/mobile/src/features/billing/use-billing-gate.ts",
  ],
  auth: [
    "apps/mobile/src/features/auth/apple-sign-in.ts",
    "apps/mobile/src/features/auth/google-sign-in.ts",
    "apps/mobile/src/features/auth/session-provider.tsx",
  ],
  "web-links": [
    "apps/mobile/src/lib/web-links.ts",
  ],
  calendar: [
    "apps/mobile/src/features/planner/device-calendar-export-sheet.tsx",
    "apps/mobile/src/features/planner/device-calendar-export.ts",
    "apps/mobile/src/features/planner/device-calendar-native.ts",
  ],
} as const;

export type NativeGauntletSurfaceGroupId = keyof typeof nativeGauntletSurfaceFileGroups;

export interface NativeGauntletStateScenario {
  id: string;
  setting: NativeGauntletSettingId;
  surfaces: readonly NativeGauntletSurfaceGroupId[];
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
    requiredMarkers: ["contrastRatio", "NON_TEXT_PAIRS", "borderColor"],
  },
  {
    id: "safe-area-and-keyboard",
    setting: "safe-area",
    surfaces: ["signin", "chat", "lesson-recorder", "voice"],
    requiredMarkers: ["SafeAreaView", "useSafeAreaInsets", "KeyboardAvoidingView", "keyboardShouldPersistTaps"],
  },
  {
    id: "offline-recovery",
    setting: "offline",
    surfaces: ["bootstrap", "progress", "chat", "share"],
    requiredMarkers: ["expo-network", "offline", "recovery", "retry"],
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

/**
 * Automatic simulator evidence is deliberately split into command facts,
 * observed product facts, and interaction facts that this runner cannot
 * establish. Every key is required. A missing key is an invalid evidence
 * record, rather than an implicit pass or an optional check.
 */
export const nativeInstalledCommandCheckIds = [
  "installedCommand",
  "launchedCommand",
  "dynamicTypeSettingCommand",
  "increaseContrastSettingCommand",
  "screenshotCaptureCommand",
  "deepLinkOpenCommand",
] as const;

export const nativeInstalledObservedCheckIds = [
  "dynamicTypeRenderObserved",
  "increaseContrastRenderObserved",
  "screenshotRenderObserved",
  "deepLinkDestinationObserved",
] as const;

export const nativeInstalledManualCheckIds = [
  "safeAreaObserved",
  "voiceOverObserved",
  "reduceMotionObserved",
  "reduceTransparencyObserved",
  "keyboardObserved",
  "offlineRecoveryObserved",
  "interruptionObserved",
  "backgroundForegroundObserved",
  "permissionsObserved",
] as const;

export const nativeInstalledRequiredCheckIds = [
  ...nativeInstalledCommandCheckIds,
  ...nativeInstalledObservedCheckIds,
  ...nativeInstalledManualCheckIds,
] as const;

export type NativeInstalledEvidenceCheckId =
  (typeof nativeInstalledRequiredCheckIds)[number];

export const nativeInstalledAssertionIds = [
  "dynamicTypeRender",
  "increaseContrastRender",
  "screenshotRender",
  "deepLinkDestination",
] as const;

export type NativeInstalledEvidenceAssertionId =
  (typeof nativeInstalledAssertionIds)[number];
