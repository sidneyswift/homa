import { usePathname, useRouter } from "expo-router";
import { useState, type RefObject } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Logo } from "../brand/logo";
import { Icon } from "../design/icon";
import { colors, fontFamilies } from "../../theme/app2";

const destinations = [
  { route: "/planner", title: "Planner", icon: "calendar" },
  { route: "/binder", title: "Binder", icon: "book" },
  { route: "/progress", title: "Progress", icon: "progress" },
] as const;

/** App 2 navigation shares the header's space with the mark, so they never overlap. */
export function AppTopBar({ menuButtonRef, onMenuPress }: { menuButtonRef?: RefObject<View | null>; onMenuPress: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const active = destinations.find(item => pathname === item.route);
  return <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.page }}>
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 60, paddingHorizontal: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={expanded ? "Close navigation" : "Open navigation"} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" }}>
        <Icon name={expanded ? "close" : "menu"} size={24} color={colors.textStrong} />
      </Pressable>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
        {expanded ? destinations.map(item => <Pressable key={item.route} accessibilityRole="button" accessibilityLabel={item.title} accessibilityState={{ selected: active?.route === item.route }} onPress={() => { setExpanded(false); router.navigate(item.route); }} style={{ minHeight: 48, paddingHorizontal: 9, alignItems: "center", justifyContent: "center", gap: 3 }}>
          <Icon name={item.icon} size={24} color={colors.textStrong} /><Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: 14, color: colors.textStrong }}>{item.title}</Text>
        </Pressable>) : <Pressable accessibilityRole="button" accessibilityLabel="Back to conversation" onPress={() => router.navigate("/chat")} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>{active ? <Text style={{ color: colors.textStrong, fontFamily: fontFamilies.bodySemibold, fontSize: 18 }}>{active.title} · Close</Text> : <Logo size={28} />}</Pressable>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Talk to Homa" onPress={() => router.navigate("/voice")} style={{ width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" }}><Icon name="voice" size={24} color={colors.textStrong} /></Pressable>
      <Pressable ref={menuButtonRef} accessibilityRole="button" accessibilityLabel="Open menu" accessibilityHint="Account, settings, and all Homa features" onPress={onMenuPress} style={{ width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" }}><Icon name="more" size={24} color={colors.textStrong} /></Pressable>
    </View>
  </SafeAreaView>;
}
