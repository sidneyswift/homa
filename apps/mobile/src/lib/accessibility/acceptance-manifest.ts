export type AccessibilityEvidenceState =
  | "required"
  | "in-progress"
  | "blocked"
  | "verified";

export interface NativeAccessibilityJourney {
  id: string;
  outcome: string;
  owners: readonly `gh#${number}`[];
  status: "blocked" | "in-progress" | "verified";
  surfaces: readonly string[];
  states: readonly AccessibilityJourneyState[];
  evidence: Readonly<Record<AccessibilityEvidenceKind, AccessibilityEvidenceState>>;
  openGate: string;
}

export type AccessibilityJourneyState =
  | "loading"
  | "streaming"
  | "success"
  | "error"
  | "interruption"
  | "empty"
  | "recovery"
  | "system-handoff";

export type AccessibilityEvidenceKind =
  | "static"
  | "rendered"
  | "simulator"
  | "physical-device"
  | "study";

export interface NativeAccessibilitySurface {
  file: string;
  kind: "layout" | "priority" | "supporting" | "excluded";
  owner: `gh#${number}`;
  reason: string;
}

export interface NativeAccessibilityHandoff {
  file: string;
  callee: string;
  outcome: string;
  owner: `gh#${number}`;
}

const ALL_STATES: readonly AccessibilityJourneyState[] = [
  "loading",
  "streaming",
  "success",
  "error",
  "interruption",
  "empty",
  "recovery",
  "system-handoff",
];

const OPEN_EVIDENCE = {
  static: "in-progress",
  rendered: "in-progress",
  simulator: "blocked",
  "physical-device": "required",
  study: "required",
} as const satisfies Readonly<Record<AccessibilityEvidenceKind, AccessibilityEvidenceState>>;

/**
 * The five award journeys are deliberately allowed to remain red here.
 * A blocker must stay named until the owner ships it and every evidence
 * dimension is updated from proof, never from repository presence.
 */
export const nativeAccessibilityJourneys: readonly NativeAccessibilityJourney[] = [
  {
    id: "native-first-family-win",
    outcome: "A new mom becomes family-ready and completes one useful outcome without leaving native.",
    owners: ["gh#304", "gh#622"],
    status: "blocked",
    surfaces: [
      "apps/mobile/src/app/(auth)/signin.tsx",
      "apps/mobile/src/app/(auth)/email.tsx",
      "apps/mobile/src/app/_layout.tsx",
      "apps/mobile/src/components/family-readiness-gate.tsx",
      "apps/mobile/src/components/ai-consent-gate.tsx",
      "apps/mobile/src/components/billing-gate.tsx",
    ],
    states: ALL_STATES,
    evidence: OPEN_EVIDENCE,
    openGate: "gh#304 still owns native onboarding and the first useful artifact.",
  },
  {
    id: "today-one-useful-priority",
    outcome: "A mom understands what matters now and can act on one of at most three priorities.",
    owners: ["gh#303"],
    status: "blocked",
    surfaces: [
      "apps/mobile/src/app/(tabs)/index.tsx",
      "apps/mobile/src/app/(tabs)/planner.tsx",
    ],
    states: ALL_STATES,
    evidence: OPEN_EVIDENCE,
    openGate: "gh#303 still owns the missing native Today surface.",
  },
  {
    id: "progress-evidence-to-next-move",
    outcome: "A mom understands the evidence, its confidence, and one editable next move.",
    owners: ["gh#617", "gh#623", "gh#645"],
    status: "in-progress",
    surfaces: [
      "apps/mobile/src/app/(tabs)/progress.tsx",
      "apps/mobile/src/app/(tabs)/chat.tsx",
    ],
    states: ALL_STATES,
    evidence: OPEN_EVIDENCE,
    openGate: "gh#623 and gh#645 still own the complete evidence-first next-move loop.",
  },
  {
    id: "voice-to-approved-outcome",
    outcome: "One ordinary spoken sentence becomes a reviewed object and a truthful approved outcome.",
    owners: ["gh#534", "gh#620"],
    status: "in-progress",
    surfaces: [
      "apps/mobile/src/app/(tabs)/voice.tsx",
      "apps/mobile/src/features/voice/voice-screen.tsx",
      "apps/mobile/src/features/voice/overlay-host.tsx",
      "apps/mobile/src/features/lessons/native-lesson-recorder.tsx",
    ],
    states: ALL_STATES,
    evidence: OPEN_EVIDENCE,
    openGate: "gh#620 still requires a spoken turn, playback, interruption, and recovery on physical hardware.",
  },
  {
    id: "optional-caregiver-handoff",
    outcome: "An authorized caregiver receives a parent-chosen task without exposure of private adult conversation.",
    owners: ["gh#618", "gh#606"],
    status: "blocked",
    surfaces: [
      "apps/mobile/src/app/settings.tsx",
      "apps/mobile/src/features/materials/material-share-composer.tsx",
    ],
    states: ALL_STATES,
    evidence: OPEN_EVIDENCE,
    openGate: "gh#606 requires the founder's re-added-adult privacy ruling before collaboration can ship safely.",
  },
];

/** Every Expo surface is classified. New files must declare an owner here. */
export const nativeAccessibilitySurfaces: readonly NativeAccessibilitySurface[] = [
  { file: "apps/mobile/src/app/_layout.tsx", kind: "layout", owner: "gh#299", reason: "Root bootstrap and navigation shell." },
  { file: "apps/mobile/src/app/(auth)/signin.tsx", kind: "priority", owner: "gh#304", reason: "Entry. Three doors, no password, no account recovery to reach." },
  { file: "apps/mobile/src/app/(auth)/email.tsx", kind: "priority", owner: "gh#304", reason: "Email door: address, then a six digit code." },
  { file: "apps/mobile/src/app/(tabs)/_layout.tsx", kind: "layout", owner: "gh#299", reason: "Signed-in shell and drawer." },
  { file: "apps/mobile/src/app/(tabs)/index.tsx", kind: "priority", owner: "gh#303", reason: "Current front-door redirect and future Today owner." },
  { file: "apps/mobile/src/app/(tabs)/voice.tsx", kind: "priority", owner: "gh#534", reason: "Default capture surface." },
  { file: "apps/mobile/src/app/(tabs)/chat.tsx", kind: "priority", owner: "gh#302", reason: "Text fallback and durable conversation." },
  { file: "apps/mobile/src/app/(tabs)/progress.tsx", kind: "priority", owner: "gh#617", reason: "Evidence and next move." },
  { file: "apps/mobile/src/app/(tabs)/planner.tsx", kind: "priority", owner: "gh#303", reason: "Plan, calendar, and school hours." },
  { file: "apps/mobile/src/app/(tabs)/binder.tsx", kind: "supporting", owner: "gh#534", reason: "Generated and state-record artifacts." },
  { file: "apps/mobile/src/app/(tabs)/hours.tsx", kind: "supporting", owner: "gh#303", reason: "Compliance record compatibility route." },
  { file: "apps/mobile/src/app/(tabs)/tasks.tsx", kind: "supporting", owner: "gh#307", reason: "Proactive Homa work." },
  { file: "apps/mobile/src/app/settings.tsx", kind: "supporting", owner: "gh#299", reason: "Account, family, plan, and policy access." },
  { file: "apps/mobile/src/app/settings/delete-account.tsx", kind: "supporting", owner: "gh#299", reason: "Irreversible account deletion." },
  { file: "apps/mobile/src/app/(onboarding)/_layout.tsx", kind: "layout", owner: "gh#304", reason: "Native onboarding walk shell, signed-in only." },
  { file: "apps/mobile/src/app/(onboarding)/hello.tsx", kind: "priority", owner: "gh#304", reason: "Post-account celebration beat, auto-advances." },
  { file: "apps/mobile/src/app/(onboarding)/intent.tsx", kind: "priority", owner: "gh#304", reason: "One-tap intent ask that routes the walk." },
  { file: "apps/mobile/src/app/(onboarding)/kids.tsx", kind: "priority", owner: "gh#304", reason: "Kid intro stepper: name, age, loves, working-on." },
  { file: "apps/mobile/src/app/(onboarding)/making.tsx", kind: "priority", owner: "gh#304", reason: "Live worksheet build with real job progress." },
  { file: "apps/mobile/src/app/(onboarding)/reveal.tsx", kind: "priority", owner: "gh#304", reason: "Finished worksheet preview and print." },
  { file: "apps/mobile/src/app/(onboarding)/next.tsx", kind: "priority", owner: "gh#304", reason: "Completes the walk and routes to what's next." },
];

/** Native and external handoffs need separate release-build evidence. */
export const nativeAccessibilityHandoffs: readonly NativeAccessibilityHandoff[] = [
  { file: "apps/mobile/src/lib/web-links.ts", callee: "Linking.openURL", outcome: "Web onboarding, policies, account, subscriptions, and support email.", owner: "gh#304" },
  { file: "apps/mobile/src/features/chat/material-card.tsx", callee: "Linking.openURL", outcome: "Material PDF or source opens.", owner: "gh#534" },
  { file: "apps/mobile/src/features/chat/library-source-card.tsx", callee: "Linking.openURL", outcome: "Family Library source opens.", owner: "gh#352" },
  { file: "apps/mobile/src/features/binder/in-progress-card.tsx", callee: "Linking.openURL", outcome: "In-progress material PDF opens.", owner: "gh#534" },
  { file: "apps/mobile/src/features/planner/activity-row.tsx", callee: "Linking.openURL", outcome: "Planner source opens.", owner: "gh#303" },
  { file: "apps/mobile/src/features/state-records/state-records-card.tsx", callee: "Linking.openURL", outcome: "State authority source or PDF opens.", owner: "gh#534" },
  { file: "apps/mobile/src/features/lessons/native-lesson-recorder.tsx", callee: "Linking.openSettings", outcome: "Microphone settings open after denial.", owner: "gh#534" },
  { file: "apps/mobile/src/features/lessons/native-lesson-recorder.tsx", callee: "AudioModule.requestRecordingPermissionsAsync", outcome: "Microphone permission is requested after an explicit prime.", owner: "gh#534" },
  { file: "apps/mobile/src/features/chat/onboarding-cards.tsx", callee: "WebBrowser.openBrowserAsync", outcome: "Full progress report opens.", owner: "gh#617" },
  { file: "apps/mobile/src/features/auth/google-sign-in.ts", callee: "WebBrowser.openAuthSessionAsync", outcome: "Google authentication session opens.", owner: "gh#304" },
  { file: "apps/mobile/src/features/auth/apple-sign-in.ts", callee: "AppleAuthentication.signInAsync", outcome: "Apple authentication sheet opens.", owner: "gh#304" },
  { file: "apps/mobile/src/components/billing-gate.tsx", callee: "requestPurchase", outcome: "StoreKit purchase begins.", owner: "gh#299" },
  { file: "apps/mobile/src/components/billing-gate.tsx", callee: "restorePurchases", outcome: "StoreKit restoration begins.", owner: "gh#299" },
  { file: "apps/mobile/src/features/materials/material-print.ts", callee: "printWithSystemSheet", outcome: "Native print destination sheet opens.", owner: "gh#534" },
  { file: "apps/mobile/src/features/materials/material-share.ts", callee: "Share.share", outcome: "Native share destination sheet opens.", owner: "gh#534" },
  { file: "apps/mobile/src/features/planner/device-calendar-native.ts", callee: "Calendar.requestCalendarPermissions", outcome: "Write-only calendar permission is requested.", owner: "gh#303" },
  { file: "apps/mobile/src/features/planner/device-calendar-native.ts", callee: "Calendar.presentPicker", outcome: "Calendar destination picker opens.", owner: "gh#303" },
  { file: "apps/mobile/src/features/planner/device-calendar-native.ts", callee: "calendar.createEvent", outcome: "The selected calendar receives a verified event.", owner: "gh#303" },
];
