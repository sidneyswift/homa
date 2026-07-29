import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { fetchBillingGate, type BillingGateState } from "../../lib/billing";

export interface UseBillingGateResult {
  /** Null while the first check is still in flight; never guessed. */
  gate: BillingGateState | null;
  refresh: () => Promise<void>;
}

/**
 * The mobile twin of every web route's familyAccountGate() check,
 * fetched once on mount and again whenever the app returns to the
 * foreground (the moment a StoreKit purchase sheet, completed outside
 * this screen's own confirm call, most needs re-checking) or after
 * confirmApplePurchase resolves.
 */
export function useBillingGate(): UseBillingGateResult {
  const [gate, setGate] = useState<BillingGateState | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const result = await fetchBillingGate();
    if (mounted.current) setGate(result);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    function onAppStateChange(next: AppStateStatus) {
      if (next === "active") void refresh();
    }
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, [refresh]);

  return { gate, refresh };
}
