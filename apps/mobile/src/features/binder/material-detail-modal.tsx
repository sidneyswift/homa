import { X } from "lucide-react-native";
import { Image, Modal, Pressable, ScrollView, Share, Text, View } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { emitFamilyEvent } from "../../lib/events";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import { useFamilyData } from "../family/use-family-data";
import type { BinderMaterial } from "./binder-model";
import { KIND_LABELS } from "./binder-model";
import {
  prepareMaterialPrintFromApp,
  readyPrintMessage,
  runPreparedMaterialPrint,
} from "../materials/material-print";
import { VoiceDock } from "../voice/voice-dock";

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
  const { family } = useFamilyData();
  const [printing, setPrinting] = useState(false);
  const [printNotice, setPrintNotice] = useState<string | null>(null);

  async function printMaterial() {
    if (!material) return;
    setPrinting(true);
    const prepared = await prepareMaterialPrintFromApp(material.id, {
      copies: 1,
      includeAnswerKey: true,
    });
    if (!prepared) {
      setPrintNotice("That could not be prepared for printing. Pull down to refresh the Binder, then try again.");
      setPrinting(false);
      return;
    }
    setPrintNotice(readyPrintMessage(prepared));
    const result = await runPreparedMaterialPrint(prepared);
    setPrintNotice(result.message);
    if (family?.id) {
      void emitFamilyEvent(family.id, "materials.print_result", {
        family_id: family.id,
        material_id: prepared.materialId,
        outcome: result.status,
        requested_copies: prepared.copies,
        pages_selected: prepared.pageIndexes.length,
        answer_key_excluded: prepared.answerKeyExcluded,
      });
    }
    setPrinting(false);
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
              label={printing ? "Opening print sheet…" : material.pageCount > 1 ? `Print all ${material.pageCount} pages` : "Print it"}
              disabled={printing}
              onPress={() => void printMaterial()}
            />
            <Button
              label="Share"
              variant="secondary"
              onPress={() => void Share.share({ title: material.title, url: material.pdfUrl })}
            />
            {printNotice ? (
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
                {printNotice}
              </Text>
            ) : null}
          </ScrollView>
        ) : null}
        <VoiceDock />
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
