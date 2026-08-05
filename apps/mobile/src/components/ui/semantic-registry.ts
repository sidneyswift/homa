import type { NativePrimitiveRole } from "@homa/design/contract";

export type NativePrimitiveDisposition = "new-primitive" | "wrap-existing" | "route-adapter";

export interface NativePrimitiveImplementation {
  component: string;
  source: string;
  disposition: NativePrimitiveDisposition;
  legacyComponents: readonly string[];
}

/** App-owned map from platform-neutral obligations to today's native implementation. */
export const nativePrimitiveRegistry = {
  text: { component: "NativeText", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "new-primitive", legacyComponents: ["react-native/Text", "route-local text styles"] },
  surface: { component: "NativeSurface", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "new-primitive", legacyComponents: ["Card", "route-local View surfaces"] },
  action: { component: "NativeAction", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "wrap-existing", legacyComponents: ["Button", "IconButton", "route-local Pressable"] },
  field: { component: "NativeField", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "wrap-existing", legacyComponents: ["TextField", "route-local TextInput"] },
  choice: { component: "NativeChoice", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "new-primitive", legacyComponents: ["route-local radio", "route-local checkbox", "route-local Switch"] },
  status: { component: "NativeStatus", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "wrap-existing", legacyComponents: ["InlineError", "LoadingStatus", "route-local status rows"] },
  identity: { component: "NativeIdentity", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "wrap-existing", legacyComponents: ["Logo", "Homa character adapters"] },
  navigation: { component: "NativeNavigation", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "new-primitive", legacyComponents: ["SidebarNav", "AppDrawer", "route-local navigation Pressable"] },
  sheet: { component: "NativeSheet", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "wrap-existing", legacyComponents: ["AccessibleModal", "route-local Modal"] },
  feedback: { component: "NativeFeedback", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "new-primitive", legacyComponents: ["useAccessibilityAnnouncement", "route-local completion cues"] },
  artifact: { component: "NativeArtifact", source: "apps/mobile/src/components/ui/semantic.tsx", disposition: "new-primitive", legacyComponents: ["material cards", "report previews", "route-local artifact rows"] },
} as const satisfies Record<NativePrimitiveRole, NativePrimitiveImplementation>;
