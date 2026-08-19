import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { NativeText } from "../../components/ui/semantic";
import { fetchReactLine } from "../../features/onboarding/react-lines";
import type { OnboardingIntent } from "../../features/onboarding/onboarding-state";
import { colors, space } from "../../theme/tokens";

/**
 * The react + frame beat after the intent tap (cadence laws 3 and 4):
 * Homa reacts to the specific pick, then names the cost and the reason
 * before the kid questions begin. The react line is live-generated with
 * a warm fallback; the frame line is fixed law, not model output.
 */
export default function FrameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = (
    typeof params.intent === "string" ? params.intent : "all"
  ) as OnboardingIntent;
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchReactLine({ kind: "intent", intent }).then((reactLine) => {
      if (!cancelled) setLine(reactLine);
    });
    return () => {
      cancelled = true;
    };
  }, [intent]);

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
            {line ?? "…"}
          </NativeText>
          <NativeText role="body" tone="body">
            Three little questions about your kid, then I make something
            for them. Deal?
          </NativeText>
        </Card>
        <Button
          label="Deal"
          size="lg"
          onPress={() => router.replace("/kids" as never)}
        />
      </View>
    </SafeAreaView>
  );
}
