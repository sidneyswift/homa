import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FilePenLine,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import {
  colors,
  fontSize,
  palette,
  pressScale,
  radius,
  shadows,
  space,
} from "../../theme/tokens";
import {
  VOICE_PROMPT_STARTERS,
  type VoicePromptStarter,
  type VoicePromptStarterId,
} from "./voice-prompt-starters-model";

const CARD_FILL_LIGHT = "rgba(255,255,255,0.78)";
const CARD_FILL_DARK = "rgba(51,46,41,0.78)";
const CARD_BORDER_LIGHT = "rgba(214,200,180,0.8)";
const CARD_BORDER_DARK = "rgba(214,200,180,0.28)";

const STARTER_ICONS: Record<VoicePromptStarterId, LucideIcon> = {
  worksheet: FilePenLine,
  lesson_plan: BookOpen,
  planner: CalendarDays,
  lesson_log: ClipboardCheck,
};

export function VoicePromptStarters({
  visible,
  tone,
  onPick,
}: {
  visible: boolean;
  tone: "light" | "dark";
  onPick: (starter: VoicePromptStarter) => void;
}) {
  if (!visible) return null;

  const dark = tone === "dark";
  const iconColor = dark ? palette.gold500 : colors.brand;
  const textColor = dark ? palette.stone50 : colors.textStrong;

  return (
    <View
      accessibilityRole="menu"
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.sm,
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
      }}
    >
      {VOICE_PROMPT_STARTERS.map((starter) => {
        const Icon = STARTER_ICONS[starter.id];
        const hint = starter.action.kind === "route"
          ? "Opens your homeschool planner"
          : "Starts this request with Homa";

        return (
          <Pressable
            key={starter.id}
            accessibilityRole="button"
            accessibilityLabel={starter.label}
            accessibilityHint={hint}
            onPress={() => onPick(starter)}
            style={({ pressed }) => ({
              ...shadows.sm,
              flexBasis: "46%",
              flexGrow: 1,
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderRadius: radius.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: dark ? CARD_BORDER_DARK : CARD_BORDER_LIGHT,
              backgroundColor: dark ? CARD_FILL_DARK : CARD_FILL_LIGHT,
              paddingHorizontal: 14,
              paddingVertical: 10,
              opacity: pressed ? 0.78 : 1,
              transform: [{ scale: pressed ? pressScale : 1 }],
            })}
          >
            <Icon size={18} color={iconColor} strokeWidth={2} />
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                lineHeight: 18,
                color: textColor,
              }}
            >
              {starter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
