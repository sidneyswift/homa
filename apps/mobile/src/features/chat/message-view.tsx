import { Text, View } from "react-native";
import type { EveMessage, EveMessagePart } from "eve/react";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";
import { MarkdownText } from "./markdown-text";
import { memoryChipFor, partIsRenderable, type MemoryChipContent } from "./message-utils";
import { MaterialCard, type MaterialArtifact } from "./material-card";

/** Transcript bubbles, the mobile twin of apps/web's message-parts.tsx. */

function MemoryChip({ chip }: { chip: MemoryChipContent }) {
  return (
    <View
      style={{
        marginTop: space.sm,
        flexDirection: "row",
        alignSelf: "flex-start",
        alignItems: "baseline",
        gap: 6,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.sageSoft,
        backgroundColor: colors.sageSoft,
        paddingHorizontal: 12,
        paddingVertical: 6,
        maxWidth: "100%",
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: fontSize.xs,
          color: colors.sage,
        }}
      >
        {chip.label}
      </Text>
      {chip.detail ? (
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.xs,
            color: colors.textBody,
            flexShrink: 1,
          }}
        >
          {chip.detail}
        </Text>
      ) : null}
    </View>
  );
}

function MessagePartView({
  part,
  isUser,
}: {
  part: EveMessagePart;
  isUser: boolean;
}) {
  if (part.type === "text") {
    if (isUser) {
      return (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            lineHeight: fontSize.base * 1.5,
            color: colors.onBrand,
          }}
        >
          {part.text}
        </Text>
      );
    }
    return <MarkdownText text={part.text} />;
  }
  if (part.type === "dynamic-tool" && part.state === "output-available") {
    if (part.toolName === "create_printable" || part.toolName === "create_worksheet") {
      // create_worksheet is the retired v1 name (legacy transcripts).
      const output = part.output as
        | { material?: MaterialArtifact; worksheet?: MaterialArtifact }
        | undefined;
      const material = output?.material ?? output?.worksheet;
      // previewUrl guards out refusals and pre-studio legacy payloads.
      if (material?.previewUrl) {
        return (
          <View style={{ marginTop: space.sm }}>
            <MaterialCard material={material} />
          </View>
        );
      }
      return null;
    }
    const chip = memoryChipFor(part);
    if (chip) return <MemoryChip chip={chip} />;
  }
  return null;
}

export function MessageView({ message }: { message: EveMessage }) {
  const isUser = message.role === "user";
  if (!message.parts.some(partIsRenderable)) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <View
        style={{
          maxWidth: "85%",
          borderRadius: radius.lg,
          paddingHorizontal: space.md,
          paddingVertical: 12,
          ...(isUser
            ? {
                backgroundColor: colors.brand,
                borderBottomRightRadius: radius.sm,
              }
            : {
                backgroundColor: colors.card,
                borderBottomLeftRadius: radius.sm,
                ...shadows.sm,
              }),
        }}
      >
        {message.parts.map((part, index) => (
          <MessagePartView key={index} part={part} isUser={isUser} />
        ))}
      </View>
    </View>
  );
}

/** The "thinking" or tool-status bubble shown while a turn is running. */
export function BusyBubble({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-start" }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderBottomLeftRadius: radius.sm,
          paddingHorizontal: space.md,
          paddingVertical: 12,
          ...shadows.sm,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            color: colors.textMuted,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
