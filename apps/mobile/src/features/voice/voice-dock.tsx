import { usePathname, useRouter } from "expo-router";
import { Mic, MicOff, PhoneOff, Sparkles } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";
import { useVoiceWorkbench } from "./voice-workbench-provider";

/** Compact persistent control for safe visual surfaces in the signed-in shell. */
export function VoiceDock() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useVoiceWorkbench();
  const visible = pathname !== "/voice" && session.status !== "idle";

  if (!visible) return null;

  const paused = session.status === "paused";
  const statusLabel = paused
    ? session.pauseReason ?? "Voice paused"
    : session.failed
      ? "Voice was interrupted"
      : session.muted
        ? "Muted"
        : session.status === "speaking"
          ? "Homa is speaking"
          : session.status === "working"
            ? "Homa is working"
            : "Listening";

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        { bottom: Math.max(insets.bottom, space.sm) },
      ]}
    >
      <View style={styles.dock} accessibilityLiveRegion="polite">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            paused
              ? "Resume voice conversation"
              : session.muted
                ? "Unmute voice conversation"
                : "Mute voice conversation"
          }
          onPress={paused ? session.resume : session.toggleMute}
          style={({ pressed }) => [styles.statusControl, pressed && styles.pressed]}
        >
          {paused || session.muted ? (
            <MicOff size={17} color={colors.brand} />
          ) : (
            <Mic size={17} color={colors.success} />
          )}
          <Text style={styles.statusText} numberOfLines={1}>{statusLabel}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to Homa voice"
          onPress={() => router.navigate("/voice")}
          hitSlop={8}
          style={({ pressed }) => [styles.iconControl, pressed && styles.pressed]}
        >
          <Sparkles size={18} color={colors.textBody} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End voice conversation"
          onPress={session.end}
          hitSlop={8}
          style={({ pressed }) => [styles.iconControl, pressed && styles.pressed]}
        >
          <PhoneOff size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: space.md,
    right: space.md,
    alignItems: "center",
  },
  dock: {
    minHeight: 52,
    maxWidth: 420,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    padding: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.card,
    ...shadows.md,
  },
  statusControl: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  statusText: {
    flex: 1,
    fontFamily: fontFamilies.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textBody,
  },
  iconControl: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.65 },
});
