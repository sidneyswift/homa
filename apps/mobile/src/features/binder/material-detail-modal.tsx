import { X } from "lucide-react-native";
import { Image, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import type { BinderMaterial } from "./binder-model";
import { KIND_LABELS } from "./binder-model";

function formatKeptOn(dateOnly: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(dateOnly),
  );
}

/**
 * Ported in spirit from apps/web/app/app/binder/material-detail-overlay.tsx.
 * Simplified for v1: no page-by-page pager (the OS PDF viewer handles
 * paging once "Print it" opens the real PDF) and no VersionRail
 * ("earlier tries") yet, a tracked gap, not a silent one.
 */
export function MaterialDetailModal({ material, onClose }: { material: BinderMaterial | null; onClose: () => void }) {
  function openPdf() {
    if (!material) return;
    Linking.openURL(material.pdfUrl).catch(() => {});
  }

  return (
    <Modal visible={material !== null} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: space.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
          }}
        >
          <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }} numberOfLines={1}>
            {material?.title ?? ""}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.textSubtle} />
          </Pressable>
        </View>

        {material ? (
          <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
            <Image
              source={{ uri: material.previewUrl }}
              accessibilityLabel={`Preview of ${material.title}`}
              style={{
                width: "100%",
                aspectRatio: 8.5 / 11,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "#FFFFFF",
              }}
              resizeMode="contain"
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
              <DetailField label="For" value={material.childName ?? "Whole family"} />
              <DetailField label="Kept on" value={formatKeptOn(material.createdAt)} />
              <DetailField label="Type" value={KIND_LABELS[material.kind]} />
              {material.subject ? <DetailField label="Subject" value={material.subject} /> : null}
            </View>

            <Button
              label={material.pageCount > 1 ? `Print all ${material.pageCount} pages` : "Print it"}
              onPress={openPdf}
            />
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 100 }}>
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: 10,
          letterSpacing: 0.4,
          color: colors.textSubtle,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
