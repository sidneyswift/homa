import type { Session } from "@supabase/supabase-js";
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MobileBootstrapFailureReason } from "@homa/core";

import { supabase } from "../../lib/supabase";
import { reportBootstrapEvent } from "../bootstrap/bootstrap-events";
import { runMobileBootstrapStep } from "../bootstrap/mobile-bootstrap";

interface SessionContextValue {
  session: Session | null;
  /** True until the persisted session has been read from storage. */
  initializing: boolean;
  failureReason: MobileBootstrapFailureReason | null;
  retry: () => void;
  continueSignedOut: () => void;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  initializing: true,
  failureReason: null,
  retry: () => {},
  continueSignedOut: () => {},
});

/**
 * Loads the persisted Supabase session once at startup and tracks every
 * auth change after that. Route groups read this to decide between the
 * sign-in screen and the tabs (the mobile twin of proxy.ts route gating;
 * RLS still enforces access regardless of what renders).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [failureReason, setFailureReason] =
    useState<MobileBootstrapFailureReason | null>(null);
  const attemptRef = useRef(0);
  const previousFailureRef = useRef<MobileBootstrapFailureReason | null>(null);

  const settleReady = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setFailureReason(null);
    setInitializing(false);
    const recoveredFrom = previousFailureRef.current;
    previousFailureRef.current = null;
    if (recoveredFrom) {
      void reportBootstrapEvent("recovered", "session", recoveredFrom);
    }
  }, []);

  const loadSession = useCallback(async () => {
    const attempt = ++attemptRef.current;
    void reportBootstrapEvent("attempted", "session");
    setInitializing(true);
    setFailureReason(null);
    const result = await runMobileBootstrapStep("session", async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    });
    if (attempt !== attemptRef.current) return;
    if (result.ok) {
      settleReady(result.value);
      return;
    }
    previousFailureRef.current = result.reason;
    setFailureReason(result.reason);
    setInitializing(false);
    void reportBootstrapEvent("failed", "session", result.reason);
  }, [settleReady]);

  const continueSignedOut = useCallback(() => {
    ++attemptRef.current;
    void supabase.auth.signOut({ scope: "local" });
    settleReady(null);
  }, [settleReady]);

  useEffect(() => {
    const timer = setTimeout(() => void loadSession(), 0);
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        ++attemptRef.current;
        settleReady(nextSession);
      },
    );
    return () => {
      clearTimeout(timer);
      subscription.subscription.unsubscribe();
    };
  }, [loadSession, settleReady]);

  return (
    <SessionContext.Provider
      value={{
        session,
        initializing,
        failureReason,
        retry: () => void loadSession(),
        continueSignedOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
