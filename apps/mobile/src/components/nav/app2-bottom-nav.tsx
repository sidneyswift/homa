import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "../design/icon";
import { colors, fontFamilies } from "../../theme/app2";
import { app2Destinations } from "./app2-destinations";

/**
 * Web App 2's destinations row beneath the composer. Tapping the open
 * destination again returns to the conversation, as web's toggle does.
 * The voice screen owns the whole canvas, so the row steps aside there.
 */
export function App2BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/voice") return null;

  return (
    <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.page }}>
      <View style={{ alignItems: "center", paddingHorizontal: 16, paddingTop: 4 }}>
        <View style={{ flexDirection: "row", width: "100%", maxWidth: 560, gap: 8 }}>
          {app2Destinations.map(item => {
            const active = pathname === item.route;
            return (
              <Pressable
                key={item.route}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                accessibilityHint={active ? "Returns to the conversation" : undefined}
                accessibilityState={{ selected: active }}
                onPress={() => router.navigate(active ? "/chat" : item.route)}
                style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 4 }}
              >
                <Icon name={item.icon} size={24} color={active ? colors.textStrong : colors.textMuted} />
                <Text
                  style={{
                    fontFamily: active ? fontFamilies.bodySemibold : fontFamilies.body,
                    fontSize: 12,
                    lineHeight: 16,
                    color: active ? colors.textStrong : colors.textMuted,
                    textDecorationLine: active ? "underline" : "none",
                  }}
                >
                  {item.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
