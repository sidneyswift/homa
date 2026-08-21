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
/** The making screen hands off the instant its job flips to
 * "completed", which can race the materials row becoming readable.
 * Keep asking for a few seconds instead of taking one look and
 * leaving the parent staring at a spinner forever. */
const FETCH_RETRY_MS = 3_000;
const FETCH_MAX_ATTEMPTS = 12;

export default function RevealScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const [material, setMaterial] = useState<MaterialSummary | null>(null);
  const [childName, setChildName] = useState<string>("");
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [stillWaiting, setStillWaiting] = useState(false);
  const loaded = useRef(false);
  useAccessibilityAnnouncement(notice);

  useEffect(() => {
    if (!family || loaded.current) return;
    loaded.current = true;
    reportOnboardingStep(family.id, "reveal");
    void saveOnboardingStep(family.id, "reveal").catch(() => {});

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    void (async () => {
      const answers = await loadOnboardingAnswers(family.id);
      if (cancelled) return;
      const first = answers?.kids?.[0];
      if (first) setChildName(first.name.trim());

      const attempt = async (tries: number) => {
        const [finals, drafts] = await Promise.all([
          getFinalMaterials(family.id).catch(() => []),
          getInProgressMaterials(family.id).catch(() => []),
        ]);
        if (cancelled) return;
        // Unattributed pages count too: some job runs landed materials
        // with no child id before the runner started stamping them
        // (2026-08-21), and during onboarding the newest family page is
        // the first making. Never claim a SIBLING's page, only unowned.
        const candidates = [...finals, ...drafts]
          .filter(
            (item) =>
              !first?.childId ||
              item.childId === first.childId ||
              item.childId === null,
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const found = candidates[0] ?? null;
        if (found) {
          setMaterial(found);
          return;
        }
        if (tries + 1 >= FETCH_MAX_ATTEMPTS) {
          setStillWaiting(true);
          return;
        }
        timer = setTimeout(() => void attempt(tries + 1), FETCH_RETRY_MS);
      };
      void attempt(0);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
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
        ) : stillWaiting ? (
          <NativeText role="body" tone="body">
            {"Still finishing up. It's landing in your Binder now, so you can find it there the moment it's ready."}
          </NativeText>
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
