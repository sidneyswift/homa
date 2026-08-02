import { Pressable, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, space } from "../../theme/tokens";
import { whisperText } from "./whisper-text";

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
 *
 * The whisper is three lines at most, so the assistant line doubles as
 * the door to the whole answer: tapping it asks the screen to open the
 * reply sheet (reply-sheet.tsx) with the full markdown-rendered reply.
 */

export function TranscriptRibbon({
  userText,
  assistantText,
  failed,
  onRetry,
  onPressReply,
  tone,
}: {
  userText: string | null;
  assistantText: string | null;
  failed: boolean;
  onRetry: () => void;
  /** Present makes the assistant line pressable (the full-reply door). */
  onPressReply?: () => void;
  tone: "light" | "dark";
}) {
  if (!userText && !assistantText && !failed) return null;

  const userWhisper = userText ? whisperText(userText) : null;
  const assistantWhisper = assistantText ? whisperText(assistantText) : null;
  const assistantColor = tone === "dark" ? palette.stone50 : colors.textBody;
  const userColor = tone === "dark" ? palette.stone300 : colors.textMuted;

  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
        gap: space.sm,
      }}
    >
      {userWhisper ? (
        <Text
          numberOfLines={3}
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * 1.45,
            color: userColor,
            textAlign: "center",
          }}
        >
          {userWhisper}
        </Text>
      ) : null}
      {assistantWhisper ? (
        onPressReply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Homa replied: ${assistantWhisper}`}
            accessibilityHint="Opens the full reply"
            onPress={onPressReply}
            style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Text
              numberOfLines={3}
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                lineHeight: fontSize.base * 1.5,
                color: assistantColor,
                textAlign: "center",
              }}
            >
              {assistantWhisper}
            </Text>
          </Pressable>
        ) : (
          <Text
            numberOfLines={3}
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              lineHeight: fontSize.base * 1.5,
              color: assistantColor,
              textAlign: "center",
            }}
          >
            {assistantWhisper}
          </Text>
        )
      ) : null}
      {failed ? (
        <View
          style={{
            alignItems: "stretch",
            gap: space.sm,
          }}
        >
          <InlineError message="Message not sent." tone={tone} />
          <Button label="Retry" variant="secondary" tone={tone} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
