import { useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { Button } from "../../components/ui/button";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, pressScale, radius, space } from "../../theme/tokens";
import { KIND_LABELS, type BinderMaterial } from "./binder-model";

/**
 * The Binder item detail sheet, the native twin of
 * apps/web/app/app/binder/material-detail-overlay.tsx: a bigger look at
 * the real preview plus its metadata, before deciding to print it. One
 * action on purpose: "Print it" hands the PDF to the system viewer via
 * Linking, the same reuse-worthy destination chat's material-card.tsx
 * opens (the viewer handles print, share, and AirPrint). Packets page
 * through their per-page previews here, same pattern as the web
 * overlay. A native Modal stands in for the web's focus-trapped dialog;
 * the OS owns focus and dismissal here.
 */

function formattedDate(iso: string): string {
  // The device clock is the family's clock on mobile; web reads
  // family.time_zone because its server renders far from the reader.
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CloseGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M6 6 L18 18 M18 6 L6 18"
        fill="none"
        stroke={colors.textSubtle}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function PagerArrow({ direction }: { direction: "back" | "forward" }) {
  const d = direction === "back" ? "M15 5 L8 12 L15 19" : "M9 5 L16 12 L9 19";
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d={d}
        fill="none"
        stroke={colors.textBody}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: radius.xs,
        backgroundColor: colors.page,
        padding: 10,
        gap: 2,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: colors.textSubtle,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: fontSize.sm,
          color: colors.textStrong,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function MaterialDetailSheet({
  material,
  onClose,
}: {
  material: BinderMaterial;
  onClose: () => void;
}) {
  const pagePreviews =
    material.pagePreviewUrls && material.pagePreviewUrls.length > 1
      ? material.pagePreviewUrls
      : [material.previewUrl];
  const [pageIndex, setPageIndex] = useState(0);
  const currentPreview =
    pagePreviews[Math.min(pageIndex, pagePreviews.length - 1)];

  function openPdf() {
    Linking.openURL(material.pdfUrl).catch(() => {
      // The sheet stays up; she can try the button again or find the
      // same PDF from chat and the web Binder.
    });
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Tap outside the card to close, matching the web overlay. */}
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={{
          flex: 1,
          // The web overlay's warm scrim (rgba over stone ink).
          backgroundColor: "rgba(51,42,33,0.42)",
          justifyContent: "center",
          padding: space.md,
        }}
      >
        <Pressable
          // Swallows taps so a tap on the card does not close the sheet.
          onPress={() => {}}
          style={{
            maxHeight: "90%",
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.card,
          }}
        >
          <ScrollView contentContainerStyle={{ padding: space.md + 4 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: space.sm,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodyBold,
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: colors.textSubtle,
                }}
              >
                {KIND_LABELS[material.kind]}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => ({
                  padding: 4,
                  borderRadius: radius.xs,
                  transform: [{ scale: pressed ? pressScale : 1 }],
                })}
              >
                <CloseGlyph />
              </Pressable>
            </View>

            <Image
              source={{ uri: currentPreview }}
              accessibilityLabel={
                pagePreviews.length > 1
                  ? `Preview of ${material.title}, page ${pageIndex + 1} of ${material.pageCount}`
                  : `Preview of ${material.title}`
              }
              style={{
                alignSelf: "center",
                marginTop: space.sm,
                width: "66%",
                aspectRatio: 8.5 / 11,
                borderRadius: radius.xs,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                backgroundColor: "#FFFFFF",
              }}
              resizeMode="cover"
            />
            {pagePreviews.length > 1 ? (
              <View
                style={{
                  alignSelf: "center",
                  width: "66%",
                  marginTop: space.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                  disabled={pageIndex === 0}
                  onPress={() => setPageIndex((index) => Math.max(0, index - 1))}
                  style={{
                    minHeight: 36,
                    minWidth: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    opacity: pageIndex === 0 ? 0.4 : 1,
                  }}
                >
                  <PagerArrow direction="back" />
                </Pressable>
                <Text
                  style={{
                    fontFamily: fontFamilies.bodySemibold,
                    fontSize: fontSize.xs,
                    color: colors.textMuted,
                  }}
                >
                  Page {pageIndex + 1} of {material.pageCount}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                  disabled={pageIndex >= pagePreviews.length - 1}
                  onPress={() =>
                    setPageIndex((index) =>
                      Math.min(pagePreviews.length - 1, index + 1),
                    )
                  }
                  style={{
                    minHeight: 36,
                    minWidth: 36,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    opacity: pageIndex >= pagePreviews.length - 1 ? 0.4 : 1,
                  }}
                >
                  <PagerArrow direction="forward" />
                </Pressable>
              </View>
            ) : null}

            <Text
              style={{
                marginTop: space.md,
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.xl,
                color: colors.textStrong,
              }}
            >
              {material.title}
            </Text>

            <View
              style={{
                marginTop: space.sm + 4,
                flexDirection: "row",
                gap: space.sm,
              }}
            >
              <MetaBox
                label="For"
                value={material.childName ?? "The whole family"}
              />
              <MetaBox label="Kept on" value={formattedDate(material.createdAt)} />
            </View>
            {material.subject ? (
              <View style={{ marginTop: space.sm, flexDirection: "row" }}>
                <MetaBox label="Subject" value={material.subject} />
              </View>
            ) : null}

            <Button
              label={
                material.pageCount > 1
                  ? `Print all ${material.pageCount} pages`
                  : "Print it"
              }
              onPress={openPdf}
              style={{ marginTop: space.md, alignSelf: "flex-start" }}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
