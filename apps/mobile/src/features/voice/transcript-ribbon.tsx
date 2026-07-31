import { Pressable, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, space } from "../../theme/tokens";

/**
 * The voice screen's whisper of a transcript: the last user utterance
 * and the last assistant reply as two soft centered lines fading upward
 * above the composer. Deliberately not a chat: no bubbles, no avatars,
 * no list, at most three lines each, and the older line (hers) sits
 * dimmer than the newer one (Homa's), so the past reads as receding.
 * Streaming assistant text updates the lower line live.
 *
 * On a failed send it carries chat's plain retry affordance ("Not
 * sent." + Retry, see chat/message-view.tsx) so the two surfaces speak
 * the same language about the same failure.
 */
export function TranscriptRibbon({
  userText,
  assistantText,
  failed,
  onRetry,
  tone,
}: {
  userText: string | null;
  assistantText: string | null;
  failed: boolean;
  onRetry: () => void;
  tone: "light" | "dark";
}) {
  if (!userText && !assistantText && !failed) return null;

  const assistantColor = tone === "dark" ? palette.stone50 : colors.textBody;
  const userColor = tone === "dark" ? palette.stone300 : colors.textSubtle;

  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
        gap: space.sm,
      }}
    >
      {userText ? (
        <Text
          numberOfLines={3}
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * 1.45,
            color: userColor,
            opacity: 0.55,
            textAlign: "center",
          }}
        >
          {userText}
        </Text>
      ) : null}
      {assistantText ? (
        <Text
          numberOfLines={3}
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            lineHeight: fontSize.base * 1.5,
            color: assistantColor,
            opacity: 0.92,
            textAlign: "center",
          }}
        >
          {assistantText}
        </Text>
      ) : null}
      {failed ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.sm,
          }}
        >
          <Text
            accessibilityRole="alert"
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.danger,
            }}
          >
            Not sent.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry"
            onPress={onRetry}
            hitSlop={8}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: tone === "dark" ? palette.stone50 : colors.textStrong,
                textDecorationLine: "underline",
              }}
            >
              Retry
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
