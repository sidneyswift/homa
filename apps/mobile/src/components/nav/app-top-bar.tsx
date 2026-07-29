import { Menu } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "../brand/logo";
import { colors, space } from "../../theme/tokens";

/**
 * Ported from apps/web/components/dashboard/mobile-nav.tsx's phone
 * bar: hamburger left (opens the drawer), wordmark center, a spacer
 * on the right balancing the hamburger (web's kid-context-switcher
 * avatar would go here for multi-kid families; not ported yet, see
 * app-drawer.tsx). Persistent across every screen in this shell,
 * mirroring web's "the app frame renders once" design.
 */
export function AppTopBar({ onMenuPress }: { onMenuPress: () => void }) {
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.page }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          paddingHorizontal: space.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={onMenuPress}
          hitSlop={8}
          style={{ padding: space.sm }}
        >
          <Menu size={22} color={colors.textBody} />
        </Pressable>

        <Logo size={24} />

        <View style={{ width: 38 }} />
      </View>
    </SafeAreaView>
  );
}
