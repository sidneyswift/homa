import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { fetchBillingGate, type BillingGateState } from "../../lib/billing";

export interface UseBillingGateResult {
  /** Null while still loading, OR when the last check failed (offline,
   *  signed out, server error). checked is the only reliable way to
   *  tell those two apart; gate alone cannot, on purpose (never guess
   *  open vs walled from a failure). */
  gate: BillingGateState | null;
  /** False until the first check settles, success or failure. A caller
   *  showing a spinner on `!checked` and a distinct retry state on
   *  `checked && gate === null` never gets stuck showing a loading
   *  spinner forever for what was actually a completed, failed check
   *  (caught once: an unreachable /api/billing/gate resolved to null
   *  in under a second, and the paywall spun forever with no way out
   *  since nothing distinguished "still checking" from "gave up"). */
  checked: boolean;
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
  const [checked, setChecked] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const result = await fetchBillingGate();
    if (mounted.current) {
      setGate(result);
      setChecked(true);
    }
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

  return { gate, checked, refresh };
}
