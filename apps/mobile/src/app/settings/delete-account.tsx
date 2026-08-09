import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { openSupportEmail } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Keep deletion discoverable while the server and legacy database paths are
 * paused. Safety does not depend on this client update because installed
 * versions may continue running until their next release.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.page }}
      edges={["top"]}
    >
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodyMedium,
                fontSize: fontSize.base,
                color: colors.textStrong,
              }}
            >
              Back
            </Text>
          </Pressable>
        </View>

        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSize.xxl,
            color: colors.textStrong,
          }}
        >
          Delete account and family data
        </Text>

        <Card style={{ gap: space.sm }}>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
            }}
          >
            Account deletion is paused while Homa repairs the final deletion
            step. This pause does not change or expose your family data.
          </Text>
        </Card>

        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            color: colors.textBody,
          }}
        >
          Billing continues unless you cancel it separately from Settings.
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            color: colors.textBody,
          }}
        >
          Need deletion now? Email Homa to record your request. We will reply
          with the next safe step.
        </Text>
        <Button
          label="Email Homa"
          variant="secondary"
          onPress={() => void openSupportEmail()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
