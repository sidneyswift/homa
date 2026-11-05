import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fontFamilies, fontSize, space } from "../../theme/app2";

/**
 * Transient stand-in for a sidebar destination whose real screen is
 * still being built (nav-shell PR, gh#305 follow-on): honest, never a
 * fake or broken screen. Each is replaced one at a time by its real
 * implementation; this component itself should have zero remaining
 * callers once that work finishes.
 */
export function ComingSoonScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg }}>
        <Text
          style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xl, color: colors.textStrong }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            color: colors.textMuted,
            marginTop: space.sm,
            textAlign: "center",
          }}
        >
          This is coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}
