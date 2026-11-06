import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { LoadingStatus } from "../../components/ui/loading-status";
import { NativeText } from "../../components/ui/semantic";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  prepareMaterialPrintFromApp,
  runPreparedMaterialPrint,
} from "../../features/materials/material-print";
import { startFirstMaking } from "../../features/onboarding/making";
import {
  loadOnboardingAnswers,
  reportOnboardingStep,
  saveOnboardingStep,
} from "../../features/onboarding/onboarding-state";
import { useWalkCharacterState, useWalkSky } from "../../features/onboarding/walk-character";
import { WalkScene } from "../../features/onboarding/walk-scene";
import { joinNatural } from "../../features/onboarding/working-chips";
import { emitFamilyEvent } from "../../lib/events";
import { hapticSuccess } from "../../lib/haptics";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import {
  getFinalMaterials,
  getInProgressMaterials,
  type MaterialSummary,
} from "../../lib/materials";
import { colors, radius, space } from "../../theme/app2";

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
  const insets = useSafeAreaInsets();
  const { family } = useFamilyData();
  const [material, setMaterial] = useState<MaterialSummary | null>(null);
  const [childName, setChildName] = useState<string>("");
  const [receipts, setReceipts] = useState<string>("");
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [stillWaiting, setStillWaiting] = useState(false);
  const [siblingLine, setSiblingLine] = useState<string | null>(null);
  const loaded = useRef(false);
  useAccessibilityAnnouncement(notice);
  // She keeps working until the page is on screen, then settles.
  useWalkCharacterState(material || stillWaiting ? "idle" : "thinking");
  useWalkSky("gold");

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
      // Receipts: the claim "nobody else" needs evidence. Echo back
      // exactly what she told us this page was built from (gauntlet
      // round 1: a name-merge headline without receipts is mail merge).
      if (first) {
        const rawLoves = Array.isArray(first.love) ? first.love : [];
        // "animals + ocean animals" reads redundant; keep the most
        // specific of any containing pair (gauntlet round 6).
        const distinct = rawLoves.filter(
          (item, index) =>
            !rawLoves.some(
              (other, otherIndex) =>
                otherIndex !== index &&
                other.toLowerCase().includes(item.toLowerCase()) &&
                other.length > item.length,
            ),
        );
        const working = Array.isArray(first.workingOn) ? (first.workingOn[0] ?? "").toLowerCase() : "";
        const parts = [...distinct.slice(0, 2), working].filter(Boolean);
        // What she said, not a claim about what the page used: a page
        // built around dinosaurs alone read "built from dinosaurs +
        // trucks" and the mom reviewer went looking for the trucks
        // (gauntlet round 1, 2026-11-04).
        if (parts.length > 0) {
          setReceipts(`You told me ${joinNatural(parts)}. Here's where I started.`);
        }
      }

      // Siblings get pages too (founder call 2026-08-24): their jobs
      // were kicked as each card finished in the walk, and this start
      // is the idempotent confirmation. Only kids whose job actually
      // confirms are named, so the line below never claims a drawing
      // that is not happening (honest theater law). The old "lands in
      // your Binder" clause is scrubbed per the 2026-08-31 ruling: the
      // word "Binder" never appears in walk copy.
      const siblings = (answers?.kids ?? []).slice(1);
      const confirmed: string[] = [];
      for (const sibling of siblings) {
        if (!sibling.childId || !sibling.name.trim()) continue;
        const started = await startFirstMaking(sibling.childId).catch(() => null);
        if (started) confirmed.push(sibling.name.trim());
      }
      if (!cancelled && confirmed.length > 0) {
        setSiblingLine(
          confirmed.length === 1
            ? `${confirmed[0]}'s page is drawing too.`
            : `${confirmed.join(" and ")}'s pages are drawing too.`,
        );
      }

      const attempt = async (tries: number) => {
        const [finals, drafts] = await Promise.all([
          getFinalMaterials(family.id).catch(() => []),
          getInProgressMaterials(family.id).catch(() => []),
        ]);
        if (cancelled) return;
        // STRICT child match only. An earlier fallback also accepted
        // unattributed (null-child) pages; it served a stale stranded
        // page as this kid's reveal while the real one was still
        // building (live 2026-08-21). The runner stamps every
        // child-pinned job's material now, so the honest behavior is to
        // keep retrying for the real page, never to grab a lookalike.
        const candidates = [...finals, ...drafts]
          .filter((item) => !first?.childId || item.childId === first.childId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const found = candidates[0] ?? null;
        if (found) {
          setMaterial(found);
          // D16: the reveal is one of the walk's three success moments,
          // and it lands when the page actually appears, never before.
          hapticSuccess();
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
    if (!material || !family || printing) return;
    setPrinting(true);
    try {
      const prepared = await prepareMaterialPrintFromApp(material.id, {
        copies: 1,
        includeAnswerKey: false,
      });
      if (!prepared) {
        setNotice("That could not be prepared for printing. It's saved; you can print it any time.");
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
      // No auto-navigation: the OS print sheet closing and the screen
      // underneath having silently become a menu read as a hard cut with
      // no receipt (founder call 2026-08-24). The moment lands here, and
      // she advances when she is ready.
      if (result.status === "completed") {
        setPrinted(true);
      }
    } catch {
      setNotice("Printing didn't open. Your page is saved; you can keep going.");
    } finally {
      setPrinting(false);
    }
  }

  const previewUrl =
    material?.pagePreviewUrls?.[0] ?? material?.previewUrl ?? null;

  return (
    <WalkScene>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          padding: space.lg,
          paddingTop: space.xl,
          gap: space.md,
          justifyContent: "center",
        }}
      >
        {/* "Nobody else." CUT per Sidney (copy-deck S9, 2026-08-31):
            emphasis, not information. */}
        <NativeText role="display" tone="strong" testID="reveal.heading">
          {childName ? `Made for ${childName}.` : "Made for your kid."}
        </NativeText>

        {receipts ? (
          <NativeText role="caption" tone="muted">
            {receipts}
          </NativeText>
        ) : null}

        {siblingLine ? (
          <NativeText role="bodySmall" tone="body">
            {siblingLine}
          </NativeText>
        ) : null}

        {previewUrl ? (
          <View
            style={{
              backgroundColor: colors.surfaceSunken,
              borderRadius: radius.xl,
              padding: space.sm,
            }}
          >
            {/* The trophy, not the document: a portrait crop at readable
                scale (gauntlet round 2: a full page at phone scale is an
                eye test, not a payoff). Print or the Binder shows the
                whole thing. The crop window's own aspect ratio must stay
                portrait, a fixed pixel height here previously fought the
                image's real aspect ratio and clipped it into a
                square/landscape-looking window regardless of the page's
                actual shape (bug, not a design choice, caught 2026-09-01:
                "I hate how this is a square instead of a portrait"). */}
            <View
              style={{
                width: "100%",
                aspectRatio: 0.75,
                borderRadius: radius.lg,
                backgroundColor: colors.card,
                overflow: "hidden",
              }}
            >
              <Image
                source={{ uri: previewUrl }}
                style={{ width: "100%", aspectRatio: 0.77 }}
                resizeMode="cover"
                accessibilityLabel={material?.title ?? "The finished page"}
              />
            </View>
          </View>
        ) : stillWaiting ? (
          <NativeText role="body" tone="body">
            {"Still finishing up. It's saved for you the moment it's ready."}
          </NativeText>
        ) : (
          <LoadingStatus label="Fetching the page" />
        )}
      </ScrollView>

      {/* Print is the hero action, so it never scrolls. Inside the
          scroll, the portrait page pushed it under the home bar on an
          iPhone (founder catch 2026-11-06, build 50). The page scrolls
          above this footer instead, the way the kids steps keep their
          forward button fixed, and the bottom inset keeps the footnote
          clear of the home indicator. App Review's 375 by 667 iPad
          window still gets both actions without scrolling. */}
      <View
        style={{
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
          paddingBottom: Math.max(insets.bottom, space.md),
          gap: space.xs,
          backgroundColor: colors.page,
        }}
      >
        {notice ? (
          <NativeText role="bodySmall" tone="body">
            {notice}
          </NativeText>
        ) : null}

        {/* The paywall (S10) is the walk's next beat after the reveal
            (walk v2, D1/D8): the walk presents the ask at the peak for
            everyone. The screen itself skips ahead when the family is
            already entitled. */}
        {material && printed ? (
          <Button
            label="Keep going"
            size="lg"
            onPress={() => router.replace("/paywall" as never)}
            testID="reveal.keepGoing"
          />
        ) : material ? (
          <Button
            label={printing ? "Sending to the printer…" : "Print it"}
            size="lg"
            onPress={() => void printMaterial()}
            disabled={printing}
            busy={printing}
            testID="reveal.print"
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/paywall" as never)}
          style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
          testID="reveal.footnoteContinue"
        >
          <NativeText role="caption" tone="muted">
            {printed ? "Saved. Print it anytime." : "Saved. Print it anytime. Keep going"}
          </NativeText>
        </Pressable>
      </View>
    </WalkScene>
  );
}
