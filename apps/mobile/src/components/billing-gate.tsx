import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { MobileBootstrapFailureReason } from "@homa/core";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ErrorCode, useIAP, type Purchase } from "expo-iap";

import {
  APPLE_NATIVE_PRODUCT_IDS,
  APPLE_NATIVE_PROVIDER_PRODUCTS,
  APPLE_PRODUCT_IDS,
  PURCHASABLE_HOMA_PLANS,
  planDefinition,
  weeklyEquivalentUsd,
  type PlanTier,
} from "../features/billing/constants";
import { useBillingGate } from "../features/billing/use-billing-gate";
import { useSession } from "../features/auth/session-provider";
import { confirmApplePurchase } from "../lib/billing";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { LoadingStatus } from "./ui/loading-status";

/**
 * The mobile twin of familyAccountGate() on the web: blocks every tab
 * until the family is entitled, the same way AiConsentGate blocks Chat
 * until consent is recorded (component shape, not billing logic). An
 * open family never mounts the paywall at all; a walled family never
 * sees Today, Chat, or Family underneath it.
 */
export function BillingGate({
  children,
  familyId,
}: {
  children: ReactNode;
  familyId: string;
}) {
  const { gate, checked, failureReason, refresh } = useBillingGate();
  const { continueSignedOut } = useSession();

  if (!checked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <LoadingStatus label="Checking your Homa plan" />
      </View>
    );
  }

  if (gate === null) {
    return (
      <GateCheckFailed
        failureReason={failureReason}
        onRetry={refresh}
        onContinueSignedOut={continueSignedOut}
      />
    );
  }

  if (gate.open) return <>{children}</>;

  return <Paywall familyId={familyId} everTrialed={gate.lapsed} onUnlocked={refresh} />;
}

/** checked is true but gate is still null: the check itself failed
 *  (offline, signed out, server error, or the endpoint unreachable),
 *  not "still loading". Distinct from the paywall on purpose: this
 *  family's entitlement is simply unknown, never assumed walled. */
function GateCheckFailed({
  failureReason,
  onRetry,
  onContinueSignedOut,
}: {
  failureReason: MobileBootstrapFailureReason | null;
  onRetry: () => Promise<void>;
  onContinueSignedOut: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: space.lg,
          justifyContent: "center",
          gap: space.lg,
        }}
      >
        <Card style={{ gap: space.md }}>
          <Text
            style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}
          >
            {"Couldn't check your account"}
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            {failureReason === "expired_session"
              ? "Your sign-in has expired. Sign in again before Homa checks your plan."
              : "That did not load. Check your connection and try again."}
          </Text>
          <Button
            label={retrying ? "Trying again…" : "Try again"}
            onPress={() => void handleRetry()}
            disabled={retrying}
          />
          {failureReason === "expired_session" ? (
            <Button
              label="Continue to sign in"
              variant="secondary"
              onPress={onContinueSignedOut}
              disabled={retrying}
            />
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

type PurchaseStep = "idle" | "purchasing" | "confirming" | "restoring";

function Paywall({
  familyId,
  everTrialed,
  onUnlocked,
}: {
  familyId: string;
  everTrialed: boolean;
  onUnlocked: () => Promise<void>;
}) {
  const [step, setStep] = useState<PurchaseStep>("idle");
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCheckedNonce, setLastCheckedNonce] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [tier, setTier] = useState<PlanTier>("regular");
  const restoredTokens = useRef(new Set<string>());
  const router = useRouter();

  // useIAP needs onPurchaseSuccess before handlePurchase can exist (it
  // depends on useIAP's own finishTransaction), so the callback is
  // threaded through a ref instead of a direct reference, avoiding the
  // circular declaration order.
  const handlePurchaseRef = useRef<(purchase: Purchase) => void>(() => {});

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    restorePurchases,
    availablePurchases,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: (purchase) => handlePurchaseRef.current(purchase),
    onPurchaseError: (error) => {
      setStep("idle");
      if (error.code === ErrorCode.UserCancelled) return;
      setErrorMessage("That didn't go through. Check your connection and try again.");
    },
  });

  const handlePurchase = useCallback(
    async (purchase: Purchase) => {
      setStep("confirming");
      setErrorMessage(null);
      const token = purchase.purchaseToken;
      if (!token) {
        setStep("idle");
        return;
      }
      const result = await confirmApplePurchase(token);
      if (!result.ok) {
        setStep("idle");
        setUnlockFailed(true);
        return;
      }
      try {
        await finishTransaction({ purchase });
      } catch {
        // Already-finished transactions throw harmlessly; entitlement
        // already landed server-side above, which is the only thing that
        // matters for unlocking the app.
      }
      setUnlockFailed(false);
      await onUnlocked();
      setStep("idle");
    },
    [finishTransaction, onUnlocked],
  );

  useEffect(() => {
    handlePurchaseRef.current = (purchase) => void handlePurchase(purchase);
  }, [handlePurchase]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void fetchProducts({ skus: APPLE_NATIVE_PRODUCT_IDS, type: "subs" }).finally(() => {
      if (!cancelled) setLastCheckedNonce(retryNonce);
    });
    return () => {
      cancelled = true;
    };
  }, [connected, retryNonce, fetchProducts]);

  useEffect(() => {
    const owned = availablePurchases.find((purchase) =>
      APPLE_PRODUCT_IDS.includes(purchase.productId),
    );
    if (!owned?.purchaseToken || restoredTokens.current.has(owned.purchaseToken)) return;
    restoredTokens.current.add(owned.purchaseToken);
    void handlePurchase(owned);
  }, [availablePurchases, handlePurchase]);

  const selectedProviderProduct = APPLE_NATIVE_PROVIDER_PRODUCTS.find(
    (product) => product.tier === tier,
  );
  const product = subscriptions.find((item) => item.id === selectedProviderProduct?.productId);
  const selectedPlan = planDefinition(tier);
  const displayPrice = product?.displayPrice ?? null;
  const weeklyEquivalent = weeklyEquivalentUsd(tier, "monthly").toFixed(2);

  async function handleBuy() {
    if (!familyId) return;
    if (!selectedProviderProduct || !product) return;
    setStep("purchasing");
    setErrorMessage(null);
    try {
      await requestPurchase({
        request: { apple: { sku: selectedProviderProduct.productId, appAccountToken: familyId } },
        type: "subs",
      });
    } catch {
      setStep("idle");
      setErrorMessage("That didn't go through. Check your connection and try again.");
    }
  }

  async function handleRestore() {
    setStep("restoring");
    setErrorMessage(null);
    try {
      await restorePurchases();
    } finally {
      setStep((current) => (current === "restoring" ? "idle" : current));
    }
  }

  const productsChecked = lastCheckedNonce === retryNonce;
  const productsUnavailable = connected && productsChecked && subscriptions.length === 0;
  const busy = step !== "idle";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: space.lg,
          justifyContent: "center",
          gap: space.lg,
        }}
      >
        <Card style={{ gap: space.md }}>
          <Text
            style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}
          >
            {everTrialed ? "Continue with Homa" : "Start with Homa"}
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            Weekly plans, practice pages, progress reports, and teaching-hour records.
          </Text>

          {unlockFailed ? (
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}
            >
              {
                "Your payment went through, but we couldn't unlock your account yet. This usually sorts itself out within a minute. Try closing and reopening the app. If it's still stuck, contact us and we'll fix it."
              }
            </Text>
          ) : null}

          {errorMessage ? (
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}
            >
              {errorMessage}
            </Text>
          ) : null}

          {productsUnavailable ? (
            <View style={{ gap: space.sm }}>
              <Text
                style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}
              >
                {"We can't reach the App Store right now. Check your connection and try again in a moment."}
              </Text>
              <Button
                label="Try again"
                variant="secondary"
                onPress={() => setRetryNonce((n) => n + 1)}
              />
            </View>
          ) : !product ? (
            <View style={{ gap: space.md }}>
              <PlanPicker tier={tier} onChange={setTier} />
              <LoadingStatus label="Loading App Store plans" style={{ marginVertical: space.sm }} />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <PlanPicker tier={tier} onChange={setTier} />
              <View
                style={{
                  gap: space.xs,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: space.md,
                }}
              >
                <Text
                  style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.lg, color: colors.textStrong }}
                >
                  {selectedPlan.name}
                </Text>
                <Text
                  style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
                >
                  {`${displayPrice} a month`}
                </Text>
                <Text
                  style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}
                >
                  {`About $${weeklyEquivalent} a week, billed monthly.`}
                </Text>
              </View>
              <Button
                label={
                  step === "purchasing" || step === "confirming"
                    ? "One moment…"
                    : `Subscribe for ${displayPrice} a month`
                }
                onPress={() => void handleBuy()}
                disabled={busy || !familyId}
              />
              <Text
                style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}
              >
                Billed monthly through your Apple Account. Cancel in your Apple Account subscription settings.
              </Text>
            </View>
          )}

          <Button
            label={step === "restoring" ? "Restoring…" : "Restore purchases"}
            variant="ghost"
            onPress={() => void handleRestore()}
            disabled={busy}
          />
          <Button
            label="Open Homa settings"
            variant="ghost"
            onPress={() => router.push("/settings")}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanPicker({ tier, onChange }: { tier: PlanTier; onChange: (tier: PlanTier) => void }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.4;
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: stacked ? "column" : "row", gap: space.xs }}>
      {PURCHASABLE_HOMA_PLANS.map((plan) => {
        const selected = plan.tier === tier;
        return (
          <Pressable
            key={plan.tier}
            accessibilityRole="radio"
            accessibilityLabel={`${plan.name} plan`}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(plan.tier)}
            style={{
              flex: stacked ? undefined : 1,
              minHeight: 44,
              borderRadius: 999,
              paddingVertical: space.sm,
              paddingHorizontal: space.xs,
              alignItems: "center",
              backgroundColor: selected ? colors.brandHover : colors.page,
              borderWidth: selected ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: selected ? colors.onBrand : colors.textStrong,
              }}
            >
              {plan.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
