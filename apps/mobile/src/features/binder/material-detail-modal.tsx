import { readActivityPlan } from "@homa/core";
import { ActivityPlanCard } from "../materials/activity-plan-card";
import { useNativeWorkspace } from "../workspace/context";
import { Image, ScrollView, Text, View } from "react-native";
import { useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Icon } from "../../components/design/icon";
import { AccessibleModal } from "../../components/ui/accessible-modal";
import { IconButton } from "../../components/ui/icon-button";
import { emitFamilyEvent } from "../../lib/events";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";
import { useFamilyData } from "../family/use-family-data";
import type { BinderMaterial } from "./binder-model";
import { KIND_LABELS } from "./binder-model";
import {
  prepareMaterialPrintFromApp,
  readyPrintMessage,
  runPreparedMaterialPrint,
} from "../materials/material-print";
import { VoiceDock } from "../voice/voice-dock";
import { MaterialShareComposer } from "../materials/material-share-composer";
import {
  prepareMaterialShareFromApp,
  type PreparedMaterialShareRequest,
} from "../materials/material-share";

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
  const workspace = useNativeWorkspace();
  const activityPlan = readActivityPlan(material?.activityPlan);
  const headingRef = useRef<View>(null);
  const { family } = useFamilyData();
  const [printing, setPrinting] = useState(false);
  const [printNotice, setPrintNotice] = useState<{ materialId: string; message: string } | null>(null);
  const [shareRequest, setShareRequest] = useState<PreparedMaterialShareRequest | null>(null);
  const [preparingShare, setPreparingShare] = useState(false);
  const activeNotice = material && printNotice?.materialId === material.id
    ? printNotice.message
    : null;
  useAccessibilityAnnouncement(activeNotice);

  async function printMaterial() {
    if (!material) return;
    setPrinting(true);
    const prepared = await prepareMaterialPrintFromApp(material.id, {
      copies: 1,
      includeAnswerKey: true,
    });
    if (!prepared) {
      setPrintNotice({
        materialId: material.id,
        message: "That could not be prepared for printing. Pull down to refresh the Binder, then try again.",
      });
      setPrinting(false);
      return;
    }
    setPrintNotice({ materialId: material.id, message: readyPrintMessage(prepared) });
    const result = await runPreparedMaterialPrint(prepared);
    setPrintNotice({ materialId: material.id, message: result.message });
    if (family?.id) {
      void emitFamilyEvent(family.id, "materials.print_result", {
        material_id: prepared.materialId,
        outcome: result.status,
        requested_copies: prepared.copies,
        pages_selected: prepared.pageIndexes.length,
        answer_key_excluded: prepared.answerKeyExcluded,
      });
    }
    setPrinting(false);
  }

  async function prepareShare() {
    if (!material) return;
    setPreparingShare(true);
    const prepared = await prepareMaterialShareFromApp(material.id);
    setPreparingShare(false);
    setShareRequest(prepared);
    if (!prepared) {
      setPrintNotice({
        materialId: material.id,
        message: "Homa could not prepare the PDF. Nothing was sent. Pull down to refresh the Binder, then try again.",
      });
    }
  }

  return (
    <AccessibleModal
      visible={material !== null}
      title={material ? `Material details. ${material.title}` : "Material details"}
      initialFocusRef={headingRef}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
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
          <View ref={headingRef} accessible accessibilityRole="header" accessibilityLabel={material ? `Material details. ${material.title}` : "Material details"} style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
              {material?.title ?? ""}
            </Text>
          </View>
          <IconButton label="Close material details" onPress={onClose}>
            <Icon name="close" size={20} color={colors.textSubtle} />
          </IconButton>
        </View>

        {material ? (
          <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
            {activityPlan && material ? <ActivityPlanCard key={material.id} id={material.id} title={material.title} plan={activityPlan} childName={material.childName} prepareQuestion={workspace ? text => { onClose(); workspace.prepareQuestion(text); } : undefined} /> : <Image
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
            />}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
              <DetailField label="For" value={material.childName ?? "Whole family"} />
              <DetailField label="Kept on" value={formatKeptOn(material.createdAt)} />
              <DetailField label="Type" value={KIND_LABELS[material.kind]} />
              {material.subject ? <DetailField label="Subject" value={material.subject} /> : null}
            </View>

            <Button
              label={printing ? "Opening print sheet…" : activityPlan ? "Print saved version" : material.pageCount > 1 ? `Print all ${material.pageCount} pages` : "Print it"}
              busy={printing}
              onPress={() => void printMaterial()}
            />
            <Button
              label={preparingShare ? "Getting the PDF ready…" : activityPlan ? "Share saved version" : "Share through another app"}
              variant="secondary"
              busy={preparingShare}
              onPress={() => void prepareShare()}
            />
            {shareRequest?.materialId === material.id ? (
              <MaterialShareComposer key={shareRequest.materialId} request={shareRequest} familyId={family?.id} />
            ) : null}
            {printNotice?.materialId === material.id ? (
              <Text accessibilityRole="text" style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
                {printNotice.message}
              </Text>
            ) : null}
          </ScrollView>
        ) : null}
        <VoiceDock />
      </SafeAreaView>
    </AccessibleModal>
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
          color: colors.textMuted,
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
