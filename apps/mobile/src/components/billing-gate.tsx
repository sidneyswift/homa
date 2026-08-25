import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { MobileBootstrapFailureReason } from "@homa/core";
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  getPendingTransactionsIOS,
  useIAP,
  type Purchase,
} from "expo-iap";

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
import {
  abandonApplePurchase,
  applePurchaseAttemptForRecovery,
  beginApplePurchase,
  completeApplePurchaseFinish,
  confirmApplePurchase,
  markApplePurchaseStoreStarted,
  pendingApplePurchaseFinish,
  resumeApplePurchaseConfirmation,
  type BillingGateState,
} from "../lib/billing";
import { getMyChildren, type ChildRecord } from "../lib/family";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { LoadingStatus } from "./ui/loading-status";

function joinNatural(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The paywall's own line, not the door's: a family who just finished
 * onboarding already has a real page and real answers on file when she
 * hits this screen (gh#1009's fix stopped the door from promising free
 * access; this is the other half, the effort-moat gap the same session
 * found: the paywall itself never mentioned what she just made). Only
 * fires for a genuinely new, unwalled-by-lapse family with a child on
 * file; a lapsed return or a childless account keeps the plain line.
 */
function firstPageLine(kids: ChildRecord[] | null, lapsed: boolean): string | null {
  if (lapsed || !kids || kids.length === 0) return null;
  // "their", never "her": no pronoun is stored on a child record, and
  // the house law is the parent's own words or singular "they", never a
  // guess from the name.
  const names = joinNatural(kids.map((kid) => kid.name));
  return `${names}'s first page is already in their Binder. Subscribing keeps Homa making their pages, planning their weeks, and tracking their progress.`;
}

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

  return (
    <StoreKitBillingBoundary
      familyId={familyId}
      checked={checked}
      gate={gate}
      failureReason={failureReason}
      onUnlocked={refresh}
      onContinueSignedOut={continueSignedOut}
    >
      {children}
    </StoreKitBillingBoundary>
  );
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

function storeKitPurchaseAttemptId(purchase: Purchase): string | null {
  if (!("appAccountToken" in purchase) || !purchase.appAccountToken) return null;
  return purchase.appAccountToken.toLowerCase();
}

function StoreKitBillingBoundary({
  children,
  familyId,
  checked,
  gate,
  failureReason,
  onUnlocked,
  onContinueSignedOut,
}: {
  children: ReactNode;
  familyId: string;
  checked: boolean;
  gate: BillingGateState | null;
  failureReason: MobileBootstrapFailureReason | null;
  onUnlocked: () => Promise<void>;
  onContinueSignedOut: () => void;
}) {
  const [step, setStep] = useState<PurchaseStep>("idle");
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [myChildren, setMyChildren] = useState<ChildRecord[] | null>(null);
  const [lastCheckedNonce, setLastCheckedNonce] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);
  const [tier, setTier] = useState<PlanTier>("regular");
  const processingPurchaseTokens = useRef(new Set<string>());
  const purchaseAttemptRef = useRef<string | null>(null);
  const purchaseInFlightRef = useRef(false);
  const recoveringFamiliesRef = useRef(new Set<string>());
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
    onPurchaseError: () => {
      // This global callback carries no appAccountToken, so it can report an
      // older attempt after a newer one starts. It may close the UI cycle, but
      // only the exact requestPurchase promise below may release its marker.
      setStep("confirming");
      setErrorMessage(
        "Homa can't confirm whether the App Store finished this purchase. Don't try again yet. Close and reopen Homa so it can check.",
      );
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
      if (processingPurchaseTokens.current.has(token)) return;
      processingPurchaseTokens.current.add(token);
      try {
        const result = await confirmApplePurchase(
          familyId,
          token,
          storeKitPurchaseAttemptId(purchase),
          purchase,
        );
        if (!result.ok) {
          setStep("idle");
          setUnlockFailed(true);
          return;
        }
        try {
          await finishTransaction({ purchase });
        } catch {
          setStep("idle");
          setUnlockFailed(true);
          setErrorMessage(
            "Homa can't confirm whether the App Store finished this purchase. Don't try again yet. Close and reopen Homa so it can check.",
          );
          return;
        }
        if (
          result.purchaseAttemptId
          && !(await completeApplePurchaseFinish(familyId, result.purchaseAttemptId))
        ) {
          setStep("idle");
          setUnlockFailed(true);
          return;
        }
        if (purchaseAttemptRef.current === result.purchaseAttemptId) {
          purchaseAttemptRef.current = null;
        }
        setUnlockFailed(false);
        if (result.blockedByDifferentAttempt) {
          setStep("idle");
          setErrorMessage(
            "Homa hasn't confirmed this App Store purchase. Don't start another purchase yet. Choose Restore purchases first.",
          );
          return;
        }
        await onUnlocked();
        setStep("idle");
      } finally {
        processingPurchaseTokens.current.delete(token);
      }
    },
    [familyId, finishTransaction, onUnlocked],
  );

  useEffect(() => {
    handlePurchaseRef.current = (purchase) => void handlePurchase(purchase);
  }, [handlePurchase]);

  const runApplePurchaseRecovery = useCallback(async () => {
    if (!familyId || recoveringFamiliesRef.current.has(familyId)) return;
    recoveringFamiliesRef.current.add(familyId);
    try {
      const recoveryAttempt = await applePurchaseAttemptForRecovery(familyId);
      if (recoveryAttempt) {
        const resumed = await resumeApplePurchaseConfirmation(familyId);
        if (resumed && !resumed.ok) return;
        const pendingFinish = await pendingApplePurchaseFinish(familyId);
        if (pendingFinish) {
          const token = pendingFinish.purchase.purchaseToken;
          if (!token || processingPurchaseTokens.current.has(token)) return;
          processingPurchaseTokens.current.add(token);
          setStep("confirming");
          setErrorMessage(null);
          try {
            await finishTransaction({ purchase: pendingFinish.purchase });
            const cleared = await completeApplePurchaseFinish(
              familyId,
              pendingFinish.attemptId,
            );
            if (!cleared) {
              setStep("idle");
              setUnlockFailed(true);
              return;
            }
            if (purchaseAttemptRef.current === pendingFinish.attemptId) {
              purchaseAttemptRef.current = null;
            }
            setUnlockFailed(false);
            await onUnlocked();
            setStep("idle");
          } catch {
            setStep("idle");
            setUnlockFailed(true);
            setErrorMessage(
              "Homa can't confirm whether the App Store finished this purchase. Don't try again yet. Close and reopen Homa so it can check.",
            );
          } finally {
            processingPurchaseTokens.current.delete(token);
          }
          return;
        }
      }

      if (Platform.OS !== "ios") return;
      const unfinished = await getPendingTransactionsIOS();
      const recoverablePurchases = recoveryAttempt
        ? unfinished.filter(
            (purchase) => storeKitPurchaseAttemptId(purchase)
              === recoveryAttempt.attemptId.toLowerCase(),
          )
        : unfinished.filter((purchase) => APPLE_PRODUCT_IDS.includes(purchase.productId));
      for (const purchase of recoverablePurchases) {
        await handlePurchase(purchase);
      }
    } catch {
      // Keep the exact journal. Mount or the next foreground transition retries
      // provider and storage failures without guessing that StoreKit is done.
    } finally {
      recoveringFamiliesRef.current.delete(familyId);
    }
  }, [familyId, finishTransaction, handlePurchase, onUnlocked]);

  useEffect(() => {
    if (!connected) return;
    void Promise.resolve().then(runApplePurchaseRecovery);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void runApplePurchaseRecovery();
    });
    return () => subscription.remove();
  }, [connected, runApplePurchaseRecovery]);

  useEffect(() => {
    if (!connected || !checked || !gate || gate.open) return;
    let cancelled = false;
    void fetchProducts({ skus: APPLE_NATIVE_PRODUCT_IDS, type: "subs" }).finally(() => {
      if (!cancelled) setLastCheckedNonce(retryNonce);
    });
    return () => {
      cancelled = true;
    };
  }, [checked, connected, gate, retryNonce, fetchProducts]);

  useEffect(() => {
    if (!checked || !gate || gate.open || gate.lapsed) return;
    let cancelled = false;
    void getMyChildren(familyId)
      .then((kids) => {
        if (!cancelled) setMyChildren(kids);
      })
      .catch(() => {
        if (!cancelled) setMyChildren([]);
      });
    return () => {
      cancelled = true;
    };
  }, [checked, familyId, gate]);

  useEffect(() => {
    for (const owned of availablePurchases) {
      if (!APPLE_PRODUCT_IDS.includes(owned.productId) || !owned.purchaseToken) continue;
      void Promise.resolve().then(() => handlePurchase(owned));
    }
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
    if (purchaseInFlightRef.current) return;
    purchaseInFlightRef.current = true;
    setStep("purchasing");
    setErrorMessage(null);
    const interlock = await beginApplePurchase(
      familyId,
      selectedProviderProduct.productId,
    );
    if (!interlock.ok) {
      setStep("idle");
      purchaseInFlightRef.current = false;
      setErrorMessage(
        interlock.reason === "account-closing"
          ? "Account deletion has already started. Homa did not open the App Store, so no new purchase began."
          : interlock.reason === "purchase-unresolved"
            ? "Homa hasn't confirmed this App Store purchase. Don't start another purchase yet. Choose Restore purchases first."
          : "That didn't go through. Check your connection and try again.",
      );
      return;
    }
    const attemptId = interlock.attemptId;
    purchaseAttemptRef.current = attemptId;
    if (!(await markApplePurchaseStoreStarted(familyId, attemptId))) {
      purchaseInFlightRef.current = false;
      const safelyCanceled = await abandonApplePurchase(familyId, attemptId);
      if (safelyCanceled && purchaseAttemptRef.current === attemptId) {
        purchaseAttemptRef.current = null;
      }
      setStep(safelyCanceled ? "idle" : "confirming");
      setErrorMessage(
        safelyCanceled
          ? "The App Store did not start the purchase. Close and reopen Homa to try again."
          : "Homa can't confirm whether the App Store finished this purchase. Don't try again yet. Close and reopen Homa so it can check.",
      );
      return;
    }
    try {
      await requestPurchase({
        request: {
          apple: {
            sku: selectedProviderProduct.productId,
            appAccountToken: attemptId,
          },
        },
        type: "subs",
      });
    } catch {
      const safelyCanceled = await abandonApplePurchase(familyId, attemptId);
      if (safelyCanceled && purchaseAttemptRef.current === attemptId) {
        purchaseAttemptRef.current = null;
      }
      setStep(safelyCanceled ? "idle" : "confirming");
      setErrorMessage(
        safelyCanceled
          ? "The App Store did not start the purchase. Close and reopen Homa to try again."
          : "Homa can't confirm whether the App Store finished this purchase. Don't try again yet. Close and reopen Homa so it can check.",
      );
    } finally {
      purchaseInFlightRef.current = false;
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
        onRetry={onUnlocked}
        onContinueSignedOut={onContinueSignedOut}
      />
    );
  }

  if (gate.open) return <>{children}</>;

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
            {gate.lapsed ? "Continue with Homa" : "Start with Homa"}
          </Text>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
          >
            {firstPageLine(myChildren, gate.lapsed) ??
              "Weekly plans, practice pages, progress reports, and teaching-hour records."}
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
              {/* A picker with one option reads as a fake choice
                  (found by the copy-reviewer gate, 2026-08-25); only
                  show it once there is a real second plan to pick. */}
              {PURCHASABLE_HOMA_PLANS.length > 1 ? (
                <PlanPicker tier={tier} onChange={setTier} />
              ) : null}
              <LoadingStatus label="Loading App Store plans" style={{ marginVertical: space.sm }} />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              {PURCHASABLE_HOMA_PLANS.length > 1 ? (
                <PlanPicker tier={tier} onChange={setTier} />
              ) : null}
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
          {/* "Open Homa settings" read as a stray door out of the
              subscribe decision (copy-reviewer gate, 2026-08-25): a
              walled family reaches this screen to sign out or delete
              their account (settings.tsx's own comment), never to
              browse settings, so the label says which. */}
          <Button
            label="Sign out or delete account"
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
