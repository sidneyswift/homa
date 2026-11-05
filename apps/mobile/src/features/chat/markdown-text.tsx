import { Text, View } from "react-native";

import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";

/**
 * A small markdown renderer for assistant replies: paragraphs, headings,
 * bullet and numbered lists, bold, italic, inline code. Intentionally
 * tiny instead of a markdown dependency; Homa's chat voice uses exactly
 * these shapes (mirrors what apps/web renders via react-markdown).
 */

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: text.slice(lastIndex, index) });
    const token = match[0];
    if (token.startsWith("**")) {
      segments.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("`")) {
      segments.push({ text: token.slice(1, -1), code: true });
    } else {
      segments.push({ text: token.slice(1, -1), italic: true });
    }
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments;
}

function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((segment, index) => (
        <Text
          key={index}
          style={[
            segment.bold ? { fontFamily: fontFamilies.bodyBold } : null,
            segment.italic ? { fontStyle: "italic" } : null,
            segment.code
              ? {
                  backgroundColor: colors.surfaceSunken,
                  borderRadius: radius.xs,
                  paddingHorizontal: 4,
                }
              : null,
          ]}
        >
          {segment.text}
        </Text>
      ))}
    </>
  );
}

type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: "list", items: list });
      list = [];
    }
  };

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }
    const headingMatch = /^#{1,4}\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: headingMatch[1] });
      continue;
    }
    const listMatch = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      flushParagraph();
      list.push(listMatch[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

const bodyStyle = {
  fontFamily: fontFamilies.body,
  fontSize: fontSize.base,
  lineHeight: fontSize.base * 1.5,
  color: colors.textBody,
} as const;

export function MarkdownText({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <View style={{ gap: space.sm }}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <Text
              key={index}
              style={{
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.lg,
                color: colors.textStrong,
              }}
            >
              <InlineText text={block.text} />
            </Text>
          );
        }
        if (block.kind === "list") {
          return (
            <View key={index} style={{ gap: 4 }}>
              {block.items.map((item, itemIndex) => (
                <View
                  key={itemIndex}
                  style={{ flexDirection: "row", gap: space.sm }}
                >
                  {/* A drawn dot, not a "\u2022" glyph: Homa's body font
                   *  has no bullet glyph, so the character fell back to
                   *  a notdef box (the "amateur" look a founder flagged
                   *  2026-07-29). A shape renders identically regardless
                   *  of font coverage. */}
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: colors.brand,
                      marginTop: bodyStyle.lineHeight / 2 - 2.5,
                    }}
                  />
                  <Text style={[bodyStyle, { flex: 1 }]}>
                    <InlineText text={item} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={index} style={bodyStyle}>
            <InlineText text={block.text} />
          </Text>
        );
      })}
    </View>
  );
}
