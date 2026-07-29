import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ErrorCode, useIAP, type Purchase } from "expo-iap";

import { REGULAR_WEEKLY_PRODUCT_ID } from "../features/billing/constants";
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
  const { gate, refresh } = useBillingGate();
  const { family } = useFamilyData();

  if (gate === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (gate.open) return <>{children}</>;

  return <Paywall familyId={family?.id ?? null} everTrialed={gate.lapsed} onUnlocked={refresh} />;
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
    void fetchProducts({ skus: [REGULAR_WEEKLY_PRODUCT_ID], type: "subs" }).finally(() => {
      if (!cancelled) setLastCheckedNonce(retryNonce);
    });
    return () => {
      cancelled = true;
    };
  }, [connected, retryNonce, fetchProducts]);

  useEffect(() => {
    const owned = availablePurchases.find(
      (purchase) => purchase.productId === REGULAR_WEEKLY_PRODUCT_ID,
    );
    if (!owned?.purchaseToken || restoredTokens.current.has(owned.purchaseToken)) return;
    restoredTokens.current.add(owned.purchaseToken);
    void handlePurchase(owned);
  }, [availablePurchases, handlePurchase]);

  async function handleBuy() {
    if (!familyId) return;
    setStep("purchasing");
    setErrorMessage(null);
    try {
      await requestPurchase({
        request: { apple: { sku: REGULAR_WEEKLY_PRODUCT_ID, appAccountToken: familyId } },
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

  const product = subscriptions.find((item) => item.id === REGULAR_WEEKLY_PRODUCT_ID);
  const displayPrice = product?.displayPrice ?? null;
  const productsChecked = lastCheckedNonce === retryNonce;
  const productsUnavailable = connected && productsChecked && !product;
  const busy = step !== "idle";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ flex: 1, padding: space.lg, justifyContent: "center", gap: space.lg }}>
        <Card style={{ gap: space.md }}>
          <Text
            style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}
          >
            {everTrialed ? "Continue with Homa" : "Start your free 7 days"}
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            {everTrialed
              ? `Your free days are up. Keep chatting, planning, and making with Homa${displayPrice ? ` for ${displayPrice} a week` : ""}.`
              : `Chat, plan, and make with Homa free for a week.${displayPrice ? ` After that, it's ${displayPrice} a week.` : ""}`}
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
            <ActivityIndicator color={colors.brand} style={{ marginVertical: space.sm }} />
          ) : (
            <View style={{ gap: space.sm }}>
              <Button
                label={
                  step === "purchasing" || step === "confirming"
                    ? "One moment…"
                    : everTrialed
                      ? `Continue for ${displayPrice} a week`
                      : "Start free"
                }
                onPress={() => void handleBuy()}
                disabled={busy || !familyId}
              />
              <Text
                style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}
              >
                {everTrialed
                  ? "Billed through your Apple Account. Cancel anytime in Settings."
                  : `Then ${displayPrice} a week, billed through your Apple Account. Cancel anytime in Settings.`}
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
      </View>
    </SafeAreaView>
  );
}
