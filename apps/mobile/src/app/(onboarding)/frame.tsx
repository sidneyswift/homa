import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { Button } from "../../components/ui/button";
import { NativeText } from "../../components/ui/semantic";
import { space } from "../../theme/tokens";
import { WalkSheet, WalkSpeech } from "../../features/onboarding/walk-scene";

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
    <WalkSheet>
      <View
        style={{
          flex: 1,
          padding: space.lg,
          paddingTop: space.xs,
          gap: space.md,
        }}
      >
        {/* Her words, attached to her: tail kissing the horizon she
            stands on, tight under the crest (the floating mid-void card
            read as an intercom; same fix as the next beat). */}
        <WalkSpeech>
          <NativeText role="bodyLarge" tone="strong">
            {line}
          </NativeText>
          <NativeText role="body" tone="body">
            Three quick questions about your kid. Then I build their
            first page.
          </NativeText>
        </WalkSpeech>
        <View style={{ marginTop: "auto", gap: space.sm }}>
          <Button
            label="Let's go"
            size="lg"
            onPress={() => router.replace("/kids" as never)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.replace("/intent" as never)}
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <NativeText role="control" tone="muted">
              Back
            </NativeText>
          </Pressable>
        </View>
      </View>
    </WalkSheet>
  );
}
