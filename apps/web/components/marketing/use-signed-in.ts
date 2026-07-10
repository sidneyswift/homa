"use client";

import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "../../lib/supabase/client";

/**
 * useSignedIn(): boolean
 * Whether a Supabase session exists in this browser. Marketing pages
 * render static, signed-out HTML, so auth state is a client-side
 * enhancement: this starts false, flips once getSession() reads the
 * cookie-backed session after mount, and then tracks onAuthStateChange
 * so chrome updates live if a session starts or ends without a full
 * navigation (the onboarding account step signs in client-side).
 * Used by Nav (auth links vs app tabs) and SignupPopupProvider (never
 * auto-pitch signup to a signed-in parent).
 */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(data.session !== null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(session !== null);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return signedIn;
}
