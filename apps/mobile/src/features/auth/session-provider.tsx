import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "../../lib/supabase";

interface SessionContextValue {
  session: Session | null;
  /** True until the persisted session has been read from storage. */
  initializing: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  initializing: true,
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

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );
    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, initializing }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
