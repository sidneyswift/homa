import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  getPendingTransactionsIOS,
  useIAP,
  type Purchase,
} from "expo-iap";

import {
  abandonApplePurchase,
  applePurchaseAttemptForRecovery,
  beginApplePurchase,
  completeApplePurchaseFinish,
  confirmApplePurchase,
  markApplePurchaseStoreStarted,
  pendingApplePurchaseFinish,
  resumeApplePurchaseConfirmation,
} from "../../lib/billing";
import {
  APPLE_NATIVE_PRODUCT_IDS,
  APPLE_PRODUCT_IDS,
} from "./constants";

/**
 * The StoreKit purchase engine, lifted verbatim from the BillingGate wall
 * (components/billing-gate.tsx) so the walk's paywall (S10, mobile
 * onboarding + paywall v2 spec) and the wall run ONE money path instead
 * of two that drift. Everything hard-won lives here: the server-side
 * purchase interlock riding StoreKit's appAccountToken, crash recovery on
 * mount and app-foreground, the finish-transaction journal, and the
 * global error callback that may only close the UI cycle, never release
 * another attempt's marker.
 *
 * Rendering stays with the consumer; this hook owns no copy and no
 * layout. Exactly one consumer mounts at a time (the walk's route group
 * and the tabs shell never render together), so the useIAP listener is
 * never doubled.
 */

export type PurchaseStep = "idle" | "purchasing" | "confirming" | "restoring";

function storeKitPurchaseAttemptId(purchase: Purchase): string | null {
  if (!("appAccountToken" in purchase) || !purchase.appAccountToken) return null;
  return purchase.appAccountToken.toLowerCase();
}

export function useApplePurchase({
  familyId,
  fetchWhen,
  onEntitled,
}: {
  familyId: string;
  /** Products are fetched (and refetched on retry) only while this is
   *  true: the wall waits for a walled gate answer; the walk's paywall
   *  fetches on mount. */
  fetchWhen: boolean;
  /** Awaited after a purchase is confirmed AND finished; the consumer
   *  refreshes its gate state here. */
  onEntitled: () => Promise<void>;
}) {
  const [step, setStep] = useState<PurchaseStep>("idle");
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCheckedNonce, setLastCheckedNonce] = useState(-1);
  const [retryNonce, setRetryNonce] = useState(0);
  const processingPurchaseTokens = useRef(new Set<string>());
  const purchaseAttemptRef = useRef<string | null>(null);
  const purchaseInFlightRef = useRef(false);
  const recoveringFamiliesRef = useRef(new Set<string>());

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
        await onEntitled();
        setStep("idle");
      } finally {
        processingPurchaseTokens.current.delete(token);
      }
    },
    [familyId, finishTransaction, onEntitled],
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
            await onEntitled();
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
  }, [familyId, finishTransaction, handlePurchase, onEntitled]);

  useEffect(() => {
    if (!connected) return;
    void Promise.resolve().then(runApplePurchaseRecovery);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void runApplePurchaseRecovery();
    });
    return () => subscription.remove();
  }, [connected, runApplePurchaseRecovery]);

  useEffect(() => {
    if (!connected || !fetchWhen) return;
    let cancelled = false;
    void fetchProducts({ skus: APPLE_NATIVE_PRODUCT_IDS, type: "subs" }).finally(() => {
      if (!cancelled) setLastCheckedNonce(retryNonce);
    });
    return () => {
      cancelled = true;
    };
  }, [connected, fetchWhen, retryNonce, fetchProducts]);

  useEffect(() => {
    for (const owned of availablePurchases) {
      if (!APPLE_PRODUCT_IDS.includes(owned.productId) || !owned.purchaseToken) continue;
      void Promise.resolve().then(() => handlePurchase(owned));
    }
  }, [availablePurchases, handlePurchase]);

  const buy = useCallback(
    async (productId: string) => {
      if (!familyId) return;
      if (!APPLE_NATIVE_PRODUCT_IDS.includes(productId)) return;
      if (!subscriptions.some((item) => item.id === productId)) return;
      if (purchaseInFlightRef.current) return;
      purchaseInFlightRef.current = true;
      setStep("purchasing");
      setErrorMessage(null);
      const interlock = await beginApplePurchase(familyId, productId);
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
              sku: productId,
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
    },
    [familyId, requestPurchase, subscriptions],
  );

  const restore = useCallback(async () => {
    setStep("restoring");
    setErrorMessage(null);
    try {
      await restorePurchases();
    } finally {
      setStep((current) => (current === "restoring" ? "idle" : current));
    }
  }, [restorePurchases]);

  const reloadProducts = useCallback(() => setRetryNonce((n) => n + 1), []);

  return {
    connected,
    subscriptions,
    /** True once the current product fetch settled (success or not);
     *  "unreachable" is connected && productsChecked && no products. */
    productsChecked: lastCheckedNonce === retryNonce,
    reloadProducts,
    step,
    unlockFailed,
    errorMessage,
    buy,
    restore,
  };
}
