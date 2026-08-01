import { usePathname, useRouter } from "expo-router";
import { ChevronDown, Mic, MicOff, PhoneOff, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";
import { deriveCharacterState } from "./character-state";
import { HomaCharacter } from "./homa-character";
import {
  voiceDockPresentation,
  voiceDockStatusLabel,
} from "./voice-dock-model";
import { useVoiceWorkbench } from "./voice-workbench-provider";

const PUCK_SIZE = 48;

/**
 * The one bottom safe lane owned by the signed-in shell. PR #552's combined
 * direction keeps routine listening and speaking to a compact Homa puck,
 * then expands into named controls whenever the parent needs to act.
 */
export function VoiceDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useVoiceWorkbench();
  const [expandedPathname, setExpandedPathname] = useState<string | null>(null);
  const presentation = voiceDockPresentation({
    pathname,
    status: session.status,
    muted: session.muted,
    manuallyExpanded: expandedPathname === pathname,
  });

  if (presentation === "hidden") return null;

  function endVoice() {
    setExpandedPathname(null);
    session.end();
  }

  const statusLabel = voiceDockStatusLabel({
    status: session.status,
    muted: session.muted,
    pauseReason: session.pauseReason,
  });
  const characterState = deriveCharacterState({
    composerFocused: false,
    turnActive: session.turnActive,
    assistantTextStreaming: session.assistantTextStreaming,
  });

  if (presentation === "compact") {
    return (
      <View style={styles.safeLane} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Homa Voice. ${statusLabel}. Show controls`}
          onPress={() => setExpandedPathname(pathname)}
          style={({ pressed }) => [styles.puck, pressed && styles.pressed]}
        >
          <HomaCharacter state={characterState} size={PUCK_SIZE} />
        </Pressable>
      </View>
    );
  }

  const paused = session.status === "paused";
  const failed = session.status === "failed";
  const connecting = session.status === "connecting";
  const primaryLabel = paused
    ? "Resume"
    : failed
      ? "Try again"
      : session.muted
        ? "Unmute"
        : connecting
          ? "Getting ready"
          : "Mute";
  const primaryAction = paused
    ? session.resume
    : failed
      ? session.retry
      : connecting
        ? endVoice
        : session.toggleMute;

  return (
    <View style={styles.safeLane} pointerEvents="box-none">
      <View style={styles.dock} accessibilityLiveRegion="polite">
        <View style={styles.puckInset} accessibilityElementsHidden>
          <HomaCharacter state={characterState} size={40} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={connecting ? "Cancel voice connection" : primaryLabel}
          onPress={primaryAction}
          style={({ pressed }) => [styles.statusControl, pressed && styles.pressed]}
        >
          {paused || session.muted ? (
            <MicOff size={17} color={colors.brand} />
          ) : (
            <Mic size={17} color={failed ? colors.brand : colors.success} />
          )}
          <View style={styles.statusCopy}>
            <Text style={styles.statusText} numberOfLines={1}>{statusLabel}</Text>
            <Text style={styles.actionText} numberOfLines={1}>{primaryLabel}</Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to Homa Voice"
          onPress={() => router.navigate("/voice")}
          hitSlop={8}
          style={({ pressed }) => [styles.iconControl, pressed && styles.pressed]}
        >
          <Sparkles size={18} color={colors.textBody} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End voice conversation"
          onPress={endVoice}
          hitSlop={8}
          style={({ pressed }) => [styles.iconControl, pressed && styles.pressed]}
        >
          <PhoneOff size={18} color={colors.textMuted} />
        </Pressable>

        {!paused && !failed && !session.muted && !connecting ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collapse Homa Voice controls"
            onPress={() => setExpandedPathname(null)}
            hitSlop={8}
            style={({ pressed }) => [styles.iconControl, pressed && styles.pressed]}
          >
            <ChevronDown size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeLane: {
    flexShrink: 0,
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.sm,
    backgroundColor: colors.page,
  },
  puck: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.card,
    ...shadows.md,
  },
  dock: {
    minHeight: 56,
    maxWidth: 440,
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
  puckInset: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radius.pill,
  },
  statusControl: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  statusCopy: { flex: 1 },
  statusText: {
    fontFamily: fontFamilies.bodySemibold,
    fontSize: fontSize.sm,
    color: colors.textBody,
  },
  actionText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  iconControl: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.65 },
});
