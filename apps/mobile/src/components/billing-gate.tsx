import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ErrorCode, useIAP, type Purchase } from "expo-iap";

import {
  APPLE_PRODUCT_IDS,
  APPLE_PROVIDER_PRODUCTS,
  HOMA_PLANS,
  planDefinition,
  weeklyEquivalentUsd,
  type BillingPeriod,
  type PlanTier,
} from "../features/billing/constants";
import { useBillingGate } from "../features/billing/use-billing-gate";
import { useFamilyData } from "../features/family/use-family-data";
import { confirmApplePurchase } from "../lib/billing";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

/**
 * The mobile twin of familyAccountGate() on the web: blocks every tab
 * until the family is entitled, the same way AiConsentGate blocks Chat
 * until consent is recorded (component shape, not billing logic). An
 * open family never mounts the paywall at all; a walled family never
 * sees Today, Chat, or Family underneath it.
 */
export function BillingGate({ children }: { children: ReactNode }) {
  const { gate, checked, refresh } = useBillingGate();
  const { family } = useFamilyData();

  if (!checked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (gate === null) {
    return <GateCheckFailed onRetry={refresh} />;
  }

  if (gate.open) return <>{children}</>;

  return <Paywall familyId={family?.id ?? null} everTrialed={gate.lapsed} onUnlocked={refresh} />;
}

/** checked is true but gate is still null: the check itself failed
 *  (offline, signed out, server error, or the endpoint unreachable),
 *  not "still loading". Distinct from the paywall on purpose: this
 *  family's entitlement is simply unknown, never assumed walled. */
function GateCheckFailed({ onRetry }: { onRetry: () => Promise<void> }) {
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
            {"That didn't load. Check your connection and try again."}
          </Text>
          <Button
            label={retrying ? "Trying again…" : "Try again"}
            onPress={() => void handleRetry()}
            disabled={retrying}
          />
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
  familyId: string | null;
  everTrialed: boolean;
  onUnlocked: () => Promise<void>;
}) {
  const [step, setStep] = useState<PurchaseStep>("idle");
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCheckedNonce, setLastCheckedNonce] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [tier, setTier] = useState<PlanTier>("regular");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
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
    void fetchProducts({ skus: APPLE_PRODUCT_IDS, type: "subs" }).finally(() => {
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

  const selectedProviderProduct = APPLE_PROVIDER_PRODUCTS.find(
    (product) => product.tier === tier && product.period === period,
  );
  const product = subscriptions.find((item) => item.id === selectedProviderProduct?.productId);
  const selectedPlan = planDefinition(tier);
  const displayPrice = product?.displayPrice ?? null;
  const weeklyEquivalent = weeklyEquivalentUsd(tier, period).toFixed(2);

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
            {everTrialed ? "Choose your Homa plan" : "Start your free 7 days"}
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            {everTrialed
              ? "Your free days are up. Pick the Homa plan that fits your family."
              : "Try every Homa surface for 7 days. Pick the plan that fits your family."}
          </Text>

          {unlockFailed ? (
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.danger }}
            >
              {
                "Your payment went through, but we couldn't unlock your account yet. This usually sorts itself out within a minute. Try closing and reopening the app. If it's still stuck, contact us and we'll fix it."
              }
            </Text>
          ) : null}

          {errorMessage ? (
            <Text
              style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.danger }}
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
              <PeriodPicker period={period} onChange={setPeriod} />
              <ActivityIndicator color={colors.brand} style={{ marginVertical: space.sm }} />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <PlanPicker tier={tier} onChange={setTier} />
              <PeriodPicker period={period} onChange={setPeriod} />
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
                  {`${displayPrice} ${period === "annual" ? "a year" : "a month"}`}
                </Text>
                <Text
                  style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}
                >
                  {`About $${weeklyEquivalent} a week, billed ${period === "annual" ? "yearly" : "monthly"}.`}
                </Text>
              </View>
              <Button
                label={
                  step === "purchasing" || step === "confirming"
                    ? "One moment…"
                    : everTrialed
                      ? `Continue with ${selectedPlan.name}`
                      : "Start free trial"
                }
                onPress={() => void handleBuy()}
                disabled={busy || !familyId}
              />
              <Text
                style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}
              >
                {everTrialed
                  ? "Billed through your Apple Account. Cancel anytime in Settings."
                  : `Then ${displayPrice} ${period === "annual" ? "a year" : "a month"}, billed through your Apple Account. Cancel anytime in Settings.`}
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
            label="Account settings"
            variant="ghost"
            onPress={() => router.push("/settings")}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanPicker({ tier, onChange }: { tier: PlanTier; onChange: (tier: PlanTier) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: space.xs }}>
      {HOMA_PLANS.map((plan) => {
        const selected = plan.tier === tier;
        return (
          <Pressable
            key={plan.tier}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(plan.tier)}
            style={{
              flex: 1,
              borderRadius: 999,
              paddingVertical: space.sm,
              paddingHorizontal: space.xs,
              alignItems: "center",
              backgroundColor: selected ? colors.brand : colors.page,
              borderWidth: selected ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text
              numberOfLines={1}
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

function PeriodPicker({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: space.xs }}>
      {(["monthly", "annual"] as const).map((option) => {
        const selected = option === period;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={{
              flex: 1,
              borderRadius: 999,
              paddingVertical: space.sm,
              alignItems: "center",
              backgroundColor: selected ? colors.textStrong : colors.page,
              borderWidth: selected ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: selected ? colors.page : colors.textStrong,
              }}
            >
              {option === "annual" ? "Yearly, save 20%" : "Monthly"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
