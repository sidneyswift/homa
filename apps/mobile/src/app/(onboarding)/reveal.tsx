import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { LoadingStatus } from "../../components/ui/loading-status";
import { NativeText } from "../../components/ui/semantic";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  prepareMaterialPrintFromApp,
  runPreparedMaterialPrint,
} from "../../features/materials/material-print";
import {
  loadOnboardingAnswers,
  reportOnboardingStep,
  saveOnboardingStep,
} from "../../features/onboarding/onboarding-state";
import { emitFamilyEvent } from "../../lib/events";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import {
  getFinalMaterials,
  getInProgressMaterials,
  type MaterialSummary,
} from "../../lib/materials";
import { colors, radius, space } from "../../theme/tokens";

/**
 * The reveal (wireframe v4 step 5, the payoff GIVE): the first kid's
 * page, full bleed, named for them, with print as the hero action.
 * The wow is the personal page, not the printing: save-for-later gets
 * the same warmth (no-printer fork). The material is read through the
 * existing RLS paths; newest page for the first child wins.
 */
export default function RevealScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const [material, setMaterial] = useState<MaterialSummary | null>(null);
  const [childName, setChildName] = useState<string>("");
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const loaded = useRef(false);
  useAccessibilityAnnouncement(notice);

  useEffect(() => {
    if (!family || loaded.current) return;
    loaded.current = true;
    reportOnboardingStep(family.id, "reveal");
    void saveOnboardingStep(family.id, "reveal").catch(() => {});
    void (async () => {
      const answers = await loadOnboardingAnswers(family.id);
      const first = answers?.kids?.[0];
      if (first) setChildName(first.name.trim());
      const [finals, drafts] = await Promise.all([
        getFinalMaterials(family.id).catch(() => []),
        getInProgressMaterials(family.id).catch(() => []),
      ]);
      const candidates = [...finals, ...drafts]
        .filter((item) => !first?.childId || item.childId === first.childId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setMaterial(candidates[0] ?? null);
    })();
  }, [family]);

  async function printMaterial() {
    if (!material || !family) return;
    setPrinting(true);
    const prepared = await prepareMaterialPrintFromApp(material.id, {
      copies: 1,
      includeAnswerKey: false,
    });
    if (!prepared) {
      setNotice("That could not be prepared for printing. It's saved in your Binder; you can print from there any time.");
      setPrinting(false);
      return;
    }
    const result = await runPreparedMaterialPrint(prepared);
    setNotice(result.message);
    void emitFamilyEvent(family.id, "materials.print_result", {
      material_id: prepared.materialId,
      outcome: result.status,
      requested_copies: prepared.copies,
      pages_selected: prepared.pageIndexes.length,
      answer_key_excluded: prepared.answerKeyExcluded,
    });
    setPrinting(false);
    if (result.status === "completed") {
      router.replace("/next" as never);
    }
  }

  const previewUrl =
    material?.pagePreviewUrls?.[0] ?? material?.previewUrl ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ flex: 1, padding: space.lg, gap: space.md, justifyContent: "center" }}>
        <NativeText role="display" tone="strong">
          {childName ? `Made for ${childName}. Nobody else.` : "Made for your kid. Nobody else."}
        </NativeText>

        {previewUrl ? (
          <Image
            source={{ uri: previewUrl }}
            style={{
              width: "100%",
              aspectRatio: 0.77,
              borderRadius: radius.lg,
              backgroundColor: colors.card,
            }}
            resizeMode="contain"
            accessibilityLabel={material?.title ?? "The finished page"}
          />
        ) : (
          <LoadingStatus label="Fetching the page" />
        )}

        {notice ? (
          <NativeText role="bodySmall" tone="body">
            {notice}
          </NativeText>
        ) : null}

        <Button
          label={printing ? "Sending to the printer…" : "Print it"}
          size="lg"
          onPress={() => void printMaterial()}
          disabled={!material || printing}
          busy={printing}
        />
        <Button
          label="It's saved in the Binder, keep going"
          variant="ghost"
          onPress={() => router.replace("/next" as never)}
        />
      </View>
    </SafeAreaView>
  );
}
