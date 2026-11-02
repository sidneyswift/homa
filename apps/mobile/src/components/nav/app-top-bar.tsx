import { usePathname, useRouter } from "expo-router";
import { type RefObject } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "../design/icon";
import { colors, fontFamilies } from "../../theme/app2";
import { app2Destinations } from "./app2-destinations";

/**
 * App 2 keeps the conversation canvas clear: Homa is the header there.
 * Elsewhere the bar names the destination and closes back to the
 * conversation. More stays on every screen, so Hours, Tasks, Settings and
 * the account remain reachable (gh#1236).
 */
export function AppTopBar({ menuButtonRef, onMenuPress }: { menuButtonRef?: RefObject<View | null>; onMenuPress: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const onConversation = pathname === "/chat" || pathname === "/";
  const destination = app2Destinations.find(item => pathname === item.route);
  return <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.page }}>
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: 8 }}>
      <View style={{ width: 44 }}>
        {onConversation ? null : <Pressable accessibilityRole="button" accessibilityLabel="Back to conversation" onPress={() => router.navigate("/chat")} style={{ width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={24} color={colors.textStrong} />
        </Pressable>}
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {destination ? <Text accessibilityRole="header" style={{ color: colors.textStrong, fontFamily: fontFamilies.bodySemibold, fontSize: 18 }}>{destination.title}</Text> : null}
      </View>
      <Pressable ref={menuButtonRef} accessibilityRole="button" accessibilityLabel="Open menu" accessibilityHint="Account, settings, and all Homa features" onPress={onMenuPress} style={{ width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" }}><Icon name="more" size={24} color={colors.textStrong} /></Pressable>
    </View>
  </SafeAreaView>;
}
