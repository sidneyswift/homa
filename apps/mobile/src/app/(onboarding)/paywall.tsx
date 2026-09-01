import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import type { ProductSubscription } from "expo-iap";

import { Button } from "../../components/ui/button";
import { LoadingStatus } from "../../components/ui/loading-status";
import { NativeText } from "../../components/ui/semantic";
import {
  APPLE_NATIVE_PROVIDER_PRODUCTS,
} from "../../features/billing/constants";
import {
  canScheduleReminders,
  scheduleTrialEndReminder,
} from "../../features/billing/trial-reminder";
import { useApplePurchase } from "../../features/billing/use-apple-purchase";
import { useBillingGate } from "../../features/billing/use-billing-gate";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  loadOnboardingAnswers,
  reportOnboardingStep,
  saveOnboardingStep,
} from "../../features/onboarding/onboarding-state";
import { hapticAdvance, hapticSuccess } from "../../lib/haptics";
import { useWalkCharacterState, useWalkSky } from "../../features/onboarding/walk-character";
import { WalkScene } from "../../features/onboarding/walk-scene";
import {
  getFinalMaterials,
  getInProgressMaterials,
  type MaterialSummary,
} from "../../lib/materials";
import { openPrivacyPolicy, openTermsOfUse } from "../../lib/web-links";
import { colors, palette, radius, space } from "../../theme/tokens";

/**
 * S10, the walk's named climax (walk v2, D8 ruled 2026-08-31): the
 * paywall PRESENTS for everyone after the reveal and never arms the
 * wall itself; arming stays report-scored in the one server-side
 * machine. Copy is the founder-approved deck
 * (plans/2026-08-30-mobile-onboarding-paywall-v2/copy-deck.md §S10).
 * Monthly only, twice ruled: ios-monthly-only-launch (2026-08-01) and
 * the founder's 2026-08-31 overruling of walk-v2 D3 (no annual plan, in
 * Apple or in this screen). The trial strings are bound to a build
 * requirement: they render only when the App Store actually returns the
 * 7-day intro offer (D2, founder action, gh#1045); until then the
 * screen presents the shipped wall's approved monthly strings, so it
 * never promises a trial the store cannot start. The reminder line
 * renders only when the reminder can really fire.
 */

const MONTHLY_PRODUCT = APPLE_NATIVE_PROVIDER_PRODUCTS.find(
  (product) => product.period === "monthly",
);

/** Days of free trial the store's introductory offer actually grants,
 *  or null when there is no free-trial intro offer (pre-D2, or a
 *  family ineligible for it). The claim source is StoreKit, never a
 *  constant, so the screen cannot promise a trial that will not apply. */
function introFreeTrialDays(product: ProductSubscription | undefined): number | null {
  if (!product || product.platform !== "ios") return null;
  const offer = product.subscriptionInfoIOS?.introductoryOffer;
  if (!offer || offer.paymentMode !== "free-trial") return null;
  const unitDays =
    offer.period.unit === "day"
      ? 1
      : offer.period.unit === "week"
        ? 7
        : offer.period.unit === "month"
          ? 30
          : offer.period.unit === "year"
            ? 365
            : 0;
  const days = unitDays * offer.period.value * offer.periodCount;
  return days > 0 ? days : null;
}

export default function PaywallScreen() {
  const router = useRouter();
  const { family } = useFamilyData();
  const { gate, checked, refresh } = useBillingGate();
  const [childName, setChildName] = useState<string>("");
  const [material, setMaterial] = useState<MaterialSummary | null>(null);
  const reported = useRef(false);
  const [reminderReady, setReminderReady] = useState(false);
  const trialDaysRef = useRef<number | null>(null);
  useWalkCharacterState("idle");
  useWalkSky("gold");

  useEffect(() => {
    void canScheduleReminders().then(setReminderReady).catch(() => {});
  }, []);

  const {
    connected,
    subscriptions,
    productsChecked,
    reloadProducts,
    step,
    unlockFailed,
    errorMessage,
    buy,
    restore,
  } = useApplePurchase({
    familyId: family?.id ?? "",
    fetchWhen: Boolean(family),
    onEntitled: async () => {
      // D16: purchase confirmed is one of the walk's three success
      // moments. D13: the automatic trial-end reminder schedules the
      // moment the trial really starts (permission asked here, never
      // mid-walk); a denial is a normal outcome and stays silent.
      hapticSuccess();
      const days = trialDaysRef.current;
      if (days) {
        await scheduleTrialEndReminder(
          new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        ).catch(() => false);
      }
      await refresh();
    },
  });

  useEffect(() => {
    if (!family || reported.current) return;
    reported.current = true;
    reportOnboardingStep(family.id, "paywall");
    void saveOnboardingStep(family.id, "paywall").catch(() => {});
    void (async () => {
      const answers = await loadOnboardingAnswers(family.id);
      const first = answers?.kids?.[0];
      if (first?.name) setChildName(first.name.trim());
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

  // An entitled family never sees purchase UI (the same double-subscribe
  // guard every web gate applies): the climax simply is not an ask for
  // someone who already said yes, so the walk moves on to the doors.
  useEffect(() => {
    if (checked && gate?.reason === "entitled") {
      router.replace("/next" as never);
    }
  }, [checked, gate, router]);

  const selectedProduct = subscriptions.find(
    (item) => item.id === MONTHLY_PRODUCT?.productId,
  ) as ProductSubscription | undefined;
  const trialDays = introFreeTrialDays(selectedProduct);
  // Deck S10 reminder line: renders only when the reminder can really
  // fire (permission already granted; the Stripe email fallback does
  // not cover Apple trials yet, gh#1045). The date is the trial's own
  // math, never a hardcoded day; computed in an effect because render
  // must stay pure (clock reads included).
  const [chargeDateLabel, setChargeDateLabel] = useState<string | null>(null);
  useEffect(() => {
    trialDaysRef.current = trialDays;
    const frame = requestAnimationFrame(() => {
      setChargeDateLabel(
        trialDays
          ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            )
          : null,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [trialDays]);

  const priceSentence = useMemo(() => {
    if (!selectedProduct) return null;
    return trialDays
      ? `${trialDays} days free, then ${selectedProduct.displayPrice} a month. Cancel anytime in the App Store.`
      : `${selectedProduct.displayPrice} a month. Cancel anytime in the App Store.`;
  }, [selectedProduct, trialDays]);

  const ctaLabel = trialDays
    ? "Try it for $0.00"
    : selectedProduct
      ? `Subscribe for ${selectedProduct.displayPrice} a month`
      : "";

  async function handleSubscribe() {
    if (!MONTHLY_PRODUCT) return;
    await buy(MONTHLY_PRODUCT.productId);
  }

  // The purchase engine refreshes the gate after a confirmed purchase;
  // the moment the gate answers entitled, the effect above advances to
  // the doors. Nothing here re-implements that navigation.

  const previewUrl = material?.pagePreviewUrls?.[0] ?? material?.previewUrl ?? null;
  const busy = step !== "idle";
  const productsUnavailable = connected && productsChecked && subscriptions.length === 0;

  return (
    <WalkScene>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, paddingTop: space.md, gap: space.md }}
      >
        {previewUrl ? (
          <View
            style={{
              backgroundColor: palette.gold100,
              borderRadius: radius.xl,
              padding: space.sm,
            }}
            testID="paywall.hero"
          >
            <View
              style={{
                width: "100%",
                height: 260,
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
        ) : null}

        <NativeText role="display" tone="strong">
          {childName ? `Keep ${childName}'s pages coming.` : "Keep the pages coming."}
        </NativeText>

        {unlockFailed ? (
          <NativeText role="bodySmall" tone="body">
            {"Your payment went through, but we couldn't unlock your account yet. This usually sorts itself out within a minute. Try closing and reopening the app. If it's still stuck, contact us and we'll fix it."}
          </NativeText>
        ) : null}

        {errorMessage ? (
          <NativeText role="bodySmall" tone="body">
            {errorMessage}
          </NativeText>
        ) : null}

        {productsUnavailable ? (
          <View style={{ gap: space.sm }}>
            <NativeText role="bodySmall" tone="muted">
              {"We can't reach the App Store right now. Check your connection and try again in a moment."}
            </NativeText>
            <Button
              label="Try again"
              variant="secondary"
              onPress={reloadProducts}
              testID="paywall.retryProducts"
            />
          </View>
        ) : !selectedProduct ? (
          <LoadingStatus label="Loading App Store plans" style={{ marginVertical: space.sm }} />
        ) : (
          <View style={{ gap: space.sm }}>
            <NativeText role="bodySmall" tone="body" testID="paywall.priceSentence">
              {priceSentence}
            </NativeText>
            <Button
              label={busy ? "One moment…" : ctaLabel}
              size="lg"
              onPress={() => void handleSubscribe()}
              disabled={busy || !family}
              testID="paywall.subscribe"
            />
            {trialDays ? (
              <NativeText role="caption" tone="muted" style={{ textAlign: "center" }}>
                Nothing due today.
              </NativeText>
            ) : null}
            {trialDays && reminderReady && chargeDateLabel ? (
              <NativeText role="caption" tone="muted" style={{ textAlign: "center" }} testID="paywall.reminderLine">
                {`Free until ${chargeDateLabel}. I'll remind you 2 days before.`}
              </NativeText>
            ) : null}
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: space.lg,
            marginTop: space.xs,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hapticAdvance();
              router.replace(
                (trialDays ? "/decline?trial=1" : "/decline") as never,
              );
            }}
            disabled={busy}
            style={{ minHeight: 44, justifyContent: "center" }}
            testID="paywall.noThanks"
          >
            <NativeText role="bodySmall" tone="body">
              No thanks
            </NativeText>
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: space.md,
            marginTop: "auto",
            paddingTop: space.md,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => void restore()}
            disabled={busy}
            style={{ minHeight: 44, justifyContent: "center" }}
            testID="paywall.restore"
          >
            <NativeText role="caption" tone="muted">
              {step === "restoring" ? "Restoring…" : "Restore purchases"}
            </NativeText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void openTermsOfUse()}
            style={{ minHeight: 44, justifyContent: "center" }}
            testID="paywall.terms"
          >
            <NativeText role="caption" tone="muted">
              Terms
            </NativeText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void openPrivacyPolicy()}
            style={{ minHeight: 44, justifyContent: "center" }}
            testID="paywall.privacy"
          >
            <NativeText role="caption" tone="muted">
              Privacy
            </NativeText>
          </Pressable>
        </View>
      </ScrollView>

    </WalkScene>
  );
}
