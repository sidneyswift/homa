import { useRouter } from "expo-router";
import { Menu, Mic } from "lucide-react-native";
import type { RefObject } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "../brand/logo";
import { IconButton } from "../ui/icon-button";
import { colors, space } from "../../theme/tokens";

/**
 * Ported from apps/web/components/dashboard/mobile-nav.tsx's phone
 * bar: hamburger left (opens the drawer), wordmark center, and the
 * voice-surface mic on the right balancing the hamburger (web's
 * kid-context-switcher avatar would need a new slot when it lands;
 * see app-drawer.tsx). Persistent across every screen in this shell,
 * mirroring web's "the app frame renders once" design.
 */
export function AppTopBar({
  menuButtonRef,
  onMenuPress,
}: {
  menuButtonRef?: RefObject<View | null>;
  onMenuPress: () => void;
}) {
  const router = useRouter();
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
        <IconButton
          ref={menuButtonRef}
          label="Open menu"
          onPress={onMenuPress}
        >
          <Menu size={22} color={colors.textBody} />
        </IconButton>

        <Logo size={24} />

        <IconButton
          label="Talk to Homa"
          onPress={() => router.navigate("/voice")}
        >
          <Mic size={22} color={colors.textBody} />
        </IconButton>
      </View>
    </SafeAreaView>
  );
}
