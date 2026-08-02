import type { MobileBootstrapFailureReason } from "@homa/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { fetchBillingGate, type BillingGateState } from "../../lib/billing";
import { reportBootstrapEvent } from "../bootstrap/bootstrap-events";

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
  failureReason: MobileBootstrapFailureReason | null;
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
  const [failureReason, setFailureReason] =
    useState<MobileBootstrapFailureReason | null>(null);
  const mounted = useRef(true);
  const attemptRef = useRef(0);
  const previousFailure = useRef<MobileBootstrapFailureReason | null>(null);

  const refresh = useCallback(async () => {
    const attempt = ++attemptRef.current;
    void reportBootstrapEvent("attempted", "billing");
    const result = await fetchBillingGate();
    if (mounted.current && attempt === attemptRef.current) {
      if (result.ok) {
        setGate(result.value);
        setFailureReason(null);
        const recoveredFrom = previousFailure.current;
        previousFailure.current = null;
        if (recoveredFrom) {
          void reportBootstrapEvent("recovered", "billing", recoveredFrom);
        }
      } else {
        setGate(null);
        setFailureReason(result.reason);
        previousFailure.current = result.reason;
        void reportBootstrapEvent("failed", "billing", result.reason);
      }
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => void refresh(), 0);
    return () => {
      clearTimeout(timer);
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

  return { gate, checked, failureReason, refresh };
}
