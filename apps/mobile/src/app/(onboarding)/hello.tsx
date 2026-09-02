import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { Button } from "../../components/ui/button";
import { NativeText } from "../../components/ui/semantic";
import { useFamilyData } from "../../features/family/use-family-data";
import { useWalkCharacterSize, useWalkSky } from "../../features/onboarding/walk-character";
import {
  reportOnboardingStep,
  saveOnboardingState,
} from "../../features/onboarding/onboarding-state";
import { WalkScene } from "../../features/onboarding/walk-scene";
import { getMyMemberDisplayName } from "../../lib/family";
import { hapticAdvance } from "../../lib/haptics";
import { openPrivacyPolicy, openTermsOfUse } from "../../lib/web-links";
import { space } from "../../theme/tokens";

/** A one-time larger entrance (founder direction 2026-09-01: "I'm ok to
 * increase the size of the logo if it helps"), reverts automatically on
 * unmount via useWalkCharacterSize so every later screen stays at the
 * default, the "one size on every beat" law only bends for this one
 * first-impression beat. */
const HELLO_CHARACTER_SIZE = 176;

/**
 * 2026-09-01: five independent, blind expert reviews (visual design,
 * color/contrast, typography, copy, first-impression UX) converged hard
 * on the same problems and are implemented here in full:
 * - the photo strip was 4-of-5 reviewers' top complaint (cropped by its
 *   container, a different visual language than the flat mascot); cut
 *   entirely rather than reframed, its space goes to the sky instead.
 * - the sky's lightness span measured 6.7pt versus Headspace's 50pt on
 *   the same region; useWalkSky("vivid") below renders a real gradient.
 * - body-text hierarchy measured as an 18-to-16pt/12.5% step, not a real
 *   level change; the identity and instruction lines now use genuinely
 *   different roles, not a near-identical pair.
 * - a real margin bug: the old maxWidth:"92%" put body text at a ~73pt
 *   right inset while every other element used a symmetric 24pt.
 * - copy tightened per the reviewer's exact suggestions (see each line).
 * NOT implemented: a dedicated saturated CTA color. The reviewers are
 * right that the button reuses the same ink ramp as text, but "primary"
 * is deliberately the contract's one midnight-ink action color system-
 * wide (button.tsx), not a per-screen choice, changing it here would
 * mean bypassing packages/design/src/contract, which the project's own
 * law forbids without a real contract update. Flagged, not bypassed.
 *
 * Underlying beat, unchanged: the GIVE right after the account moment
 * (cadence law 8: celebrate the heaviest ask immediately, briefly). Homa
 * greets the parent BY NAME when we have one, introduces herself, and
 * explains the product once in plain words before the first ask (founder
 * direction 2026-08-21). No auto-advance: she said hello, the parent
 * decides when to walk.
 */
export default function HelloScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const reported = useRef(false);
  const advanced = useRef(false);
  useWalkCharacterSize(HELLO_CHARACTER_SIZE);
  useWalkSky("vivid");
  // undefined = still resolving (render nothing rather than swap text
  // mid-read; founder law 2026-08-18, the screen arrives whole).
  const [firstName, setFirstName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void getMyMemberDisplayName()
      .catch(() => null)
      .then((memberName) => {
        if (cancelled) return;
        const raw = memberName ?? family?.parent_display_name ?? null;
        setFirstName(raw ? raw.trim().split(/\s+/)[0] : null);
      });
    return () => {
      cancelled = true;
    };
  }, [family]);

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "hello");
    void saveOnboardingState(family.id, "hello", {});
  }, [family]);

  function advance() {
    if (advanced.current) return;
    advanced.current = true;
    hapticAdvance();
    router.replace("/kids" as never);
  }

  return (
    <WalkScene>
      {/* A ScrollView, not a bare flex View (matching paywall.tsx's own
          safety net): the backdrop below is tall enough that a short
          device or a long parent name could otherwise push the button
          past the bottom edge with no way to reach it, caught 2026-09-01
          when a first attempt did exactly that. contentContainerStyle's
          flexGrow keeps the footer pinned to the bottom via marginTop:
          "auto" when there IS enough room, and only actually scrolls
          when there is not. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: space.lg,
            paddingTop: space.xl,
          }}
        >
          {firstName !== undefined ? (
            <>
              {/* Headline and identity line read as one group (tight
                  gap, both tone="strong"): who's talking. Margin bug
                  fixed 2026-09-01: the old maxWidth:"92%" put this text
                  at a ~73pt right inset while every other element on
                  the screen (including the button below) used a
                  symmetric 24pt; text now shares that same margin. */}
              <NativeText
                role="display"
                tone="strong"
                style={{ fontSize: 40, lineHeight: 50 }}
              >
                {firstName ? `Hi ${firstName}, glad you're here.` : "Hi, glad you're here."}
              </NativeText>
              {/* Names what kind of worksheets, per the copy review:
                  "worksheets" alone didn't commit to a category. */}
              <NativeText role="bodyLarge" tone="strong" style={{ marginTop: space.xs }}>
                {"I'm Homa. I make custom learning worksheets for your kids."}
              </NativeText>
              {/* Decisive hierarchy step, not a 2pt/12.5% one: bodySmall
                  is a real size-and-role drop from bodyLarge above, the
                  ~1.8x-class jump the panel measured on Headspace's own
                  headline-to-subtitle step. The old "Tell me about your
                  family" sentence is cut per the copy review: it added
                  no information and sat, unearning its place, between
                  two stronger sentences. */}
              <NativeText role="bodySmall" tone="muted" style={{ marginTop: space.lg }}>
                {"Your kid's name goes right on the first worksheet."}
              </NativeText>
            </>
          ) : null}
        </View>

        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: space.xxl,
            gap: space.sm,
          }}
        >
          {/* Button first, legal line below it: matches every other walk
              screen's footer (intent/kids/you/making all put their
              secondary line under the primary button), so "Let's talk"
              lands close to every later screen's CTA instead of drifting
              with whatever sits below it. Caught 2026-09-02: measuring
              Headspace's own onboarding found its primary button pinned
              to an identical band (89-95% of screen height) across 4 of
              5 varied screen types; this screen was the one outlier in
              Homa's own walk. Bottom padding is xxl, not the sibling
              screens' lg: their secondary line is a short "Back" control
              (role="control", button-sized text), ours is a full legal
              disclosure sentence (role="caption", correctly smaller, same
              role paywall.tsx uses for its own Terms/Privacy line), so it
              takes less vertical space and needs the extra padding below
              to land the button at the same measured height regardless. */}
          <Button label="Let's talk" size="lg" onPress={advance} testID="hello.letsGo" />
          {/* Confirms what tapping just did, tying the legal links to the
              action already taken rather than two bare words with
              nothing connecting them to it. */}
          <NativeText
            role="caption"
            tone="muted"
            style={{ textAlign: "center" }}
          >
            {"By continuing, you agree to our "}
            <NativeText
              role="caption"
              tone="muted"
              style={{ textDecorationLine: "underline" }}
              onPress={() => void openTermsOfUse()}
              accessibilityRole="link"
              testID="hello.terms"
            >
              Terms
            </NativeText>
            {" and "}
            <NativeText
              role="caption"
              tone="muted"
              style={{ textDecorationLine: "underline" }}
              onPress={() => void openPrivacyPolicy()}
              accessibilityRole="link"
              testID="hello.privacy"
            >
              Privacy
            </NativeText>
            {"."}
          </NativeText>
        </View>
      </ScrollView>
    </WalkScene>
  );
}
