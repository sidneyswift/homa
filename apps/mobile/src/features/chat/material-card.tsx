import { Image, Linking, Pressable, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

/**
 * A create_printable result: the rendered page's preview image with the
 * real PDF one tap away (the system viewer handles print/share/AirPrint).
 * Mirrors apps/web/app/app/material-card.tsx; keep the payload shape and
 * kind headlines in sync with the tool's output.
 */

export interface MaterialArtifact {
  id?: string;
  title: string;
  kind?: string;
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  /** PDF pages; absent or 1 on classic single-page materials. */
  pageCount?: number;
  /** Per-page previews (page 1 first) when more than one page exists. */
  pagePreviewUrls?: string[];
  status?: "draft" | "final" | "superseded";
  revisesId?: string | null;
  pageRoles?: ("child" | "answer_key" | "parent_guide" | "other")[];
  sources?: {
    id: string;
    title: string;
    libraryUrl: string | null;
  }[];
}

const KIND_HEADLINES: Record<string, string> = {
  worksheet: "Worksheet ready",
  coloring: "Coloring page ready",
  flashcards: "Flash cards ready",
  reader: "Reader ready",
  poster: "Poster ready",
  infographic: "Infographic ready",
  game: "Game ready",
  packet: "Packet ready",
};

export function MaterialCard({ material }: { material: MaterialArtifact }) {
  const headline = KIND_HEADLINES[material.kind ?? ""] ?? "Ready to print";
  const pageCount = material.pageCount ?? 1;
  const subtitle = [
    pageCount > 1 ? `${pageCount} pages, one PDF` : null,
    material.skill,
    material.childName ? `for ${material.childName}` : null,
  ]
    .filter(Boolean)
    .join(" \u00B7 ");

  function openPdf() {
    Linking.openURL(material.pdfUrl).catch(() => {
      // The chat text already tells her it's ready on the web too.
    });
  }

  return (
    <Card style={{ padding: space.md, gap: space.sm }}>
      <Text
        style={{
          fontFamily: fontFamilies.bodyMedium,
          fontSize: fontSize.sm,
          color: colors.textStrong,
        }}
      >
        {headline}
      </Text>
      <Text
        style={{
          fontFamily: fontFamilies.displaySemibold,
          fontSize: fontSize.lg,
          color: colors.textStrong,
        }}
      >
        {material.title}
      </Text>
      {subtitle.length > 0 ? (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textMuted,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      {material.sources && material.sources.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Text
            style={{
              fontFamily: fontFamilies.bodyMedium,
              fontSize: fontSize.xs,
              color: colors.textMuted,
            }}
          >
            Made from
          </Text>
          {material.sources.map((source, index) => (
            <Pressable
              key={source.id}
              disabled={!source.libraryUrl}
              accessibilityRole={source.libraryUrl ? "link" : "text"}
              accessibilityLabel={source.libraryUrl ? `Open source ${source.title}` : source.title}
              accessibilityHint={source.libraryUrl ? "Opens outside Homa" : undefined}
              onPress={() => {
                if (!source.libraryUrl) return;
                void Linking.openURL(source.libraryUrl);
              }}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 2 }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodyMedium,
                  fontSize: fontSize.xs,
                  color: source.libraryUrl ? colors.textStrong : colors.textMuted,
                  textDecorationLine: source.libraryUrl ? "underline" : "none",
                }}
              >
                {index > 0 ? `, ${source.title}` : source.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable
        accessible
        onPress={openPdf}
        accessibilityRole="link"
        accessibilityLabel={`Open PDF for ${material.title}`}
        accessibilityHint="Opens outside Homa"
      >
        <Image
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          source={{ uri: material.previewUrl }}
          style={{
            width: "100%",
            aspectRatio: 8.5 / 11,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "#FFFFFF",
          }}
          resizeMode="cover"
        />
      </Pressable>
      <Button
        label={pageCount > 1 ? `Open the ${pageCount}-page PDF` : "Open the printable PDF"}
        onPress={openPdf}
        style={{ alignSelf: "flex-start" }}
      />
    </Card>
  );
}
