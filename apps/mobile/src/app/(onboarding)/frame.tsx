import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { NativeText } from "../../components/ui/semantic";
import { colors, space } from "../../theme/tokens";

/**
 * The react + frame beat after the intent tap (cadence laws 3 and 4):
 * Homa reacts to the specific pick, then names the cost and the reason
 * before the kid questions begin. The react line arrives fully formed
 * as a route param, fetched by the intent screen before navigating, so
 * this screen never renders a placeholder that later swaps for
 * generated text (founder feedback 2026-08-18).
 */
const FALLBACK_LINE = "We'll start with the thing kids actually grab.";

export default function FrameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ line?: string }>();
  const line =
    typeof params.line === "string" && params.line.trim()
      ? params.line
      : FALLBACK_LINE;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: space.lg,
          gap: space.md,
        }}
      >
        <Card style={{ gap: space.md }}>
          <NativeText role="bodyLarge" tone="strong">
            {line}
          </NativeText>
          <NativeText role="body" tone="body">
            Three little questions about your kid, then I make something
            just for them.
          </NativeText>
        </Card>
        <Button
          label="Let's go"
          size="lg"
          onPress={() => router.replace("/kids" as never)}
        />
      </View>
    </SafeAreaView>
  );
}
