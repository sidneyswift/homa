import { Redirect, Stack } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { AppDrawer } from "../../components/nav/app-drawer";
import { AppTopBar } from "../../components/nav/app-top-bar";
import { BillingGate } from "../../components/billing-gate";
import { FamilyReadinessGate } from "../../components/family-readiness-gate";
import { useSession } from "../../features/auth/session-provider";
import { useFamilyData } from "../../features/family/use-family-data";
import { VoiceDock } from "../../features/voice/voice-dock";
import { colors } from "../../theme/tokens";

/**
 * The signed-in shell, ported from web's DashboardShell: a persistent
 * top bar (hamburger, opens the sidebar drawer) around whatever screen
 * is active, matching web's "the app frame renders once, content
 * swaps underneath" architecture (apps/web/components/dashboard/
 * shell.tsx). Replaces the bottom tab bar (founder call 2026-07-29:
 * copy web's own nav format instead). BillingGate wraps only the
 * screens, not /settings, so a walled family can still sign out,
 * restore purchases, or delete their account.
 *
 * Web's per-kid ViewingRows/DesktopContextSwitcher are not ported yet
 * (they need view-context session state this app doesn't have): a
 * known, tracked gap, not a silent one.
 */
export default function AppShellLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/signin" />;

  return (
    <FamilyReadinessGate>
      {(family) => (
        <BillingGate familyId={family.id}>
          <AppShell />
        </BillingGate>
      )}
    </FamilyReadinessGate>
  );
}

function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<View>(null);
  const { family, memberDisplayName } = useFamilyData();

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={drawerOpen}
        importantForAccessibility={drawerOpen ? "no-hide-descendants" : "auto"}
      >
        <AppTopBar menuButtonRef={menuButtonRef} onMenuPress={() => setDrawerOpen(true)} />
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.page },
            }}
          />
        </View>
        <VoiceDock />
      </View>
      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        parentName={memberDisplayName ?? family?.parent_display_name ?? "You"}
        familyName={family?.name ?? "Your family"}
        returnFocusRef={menuButtonRef}
      />
    </View>
  );
}
