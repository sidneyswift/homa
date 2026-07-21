import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BinderView } from "../features/binder/binder-view";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";

/**
 * /binder: the family's saved materials library, the mobile twin of
 * apps/web/app/app/binder/page.tsx. A stack route above the tabs (the
 * More tab links here), so it draws its own back affordance: the root
 * Stack hides headers app-wide.
 */
export default function BinderScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.page }}
      edges={["top"]}
    >
      <View
        style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => {
            // A cold deep link has no history to pop; land on Today.
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          style={{ alignSelf: "flex-start" }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodyMedium,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            {"←"} Back
          </Text>
        </Pressable>
      </View>
      <BinderView />
    </SafeAreaView>
  );
}
