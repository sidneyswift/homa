"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { SignupPopupModal } from "./SignupPopupModal";

/**
 * Landing-page signup popup, shared across Nav/Hero/ScrollCta/CtaBand so
 * there's exactly one modal instance and one source of truth for whether
 * it's open. `useSignupPopup()` returns null outside this provider (Nav
 * also renders on /onboarding and /blog, where "Sign up" should keep
 * navigating straight to /onboarding instead), so every call site falls
 * back to its old link behavior when the popup isn't available.
 *
 * Founder call 2026-07-08: every landing CTA opens the popup instead of
 * navigating away, and the popup also opens itself once a visitor has
 * scrolled far enough to read past the hero, so it never interrupts
 * someone who just landed. `SHOWN_KEY` makes that a once-ever thing per
 * browser, matching ScrollCta's own localStorage-remembered dismissal.
 */

const SHOWN_KEY = "homa_landing_popup_auto_shown";
/** Scroll depth that counts as "engaged with the page", not "just landed". */
const AUTO_OPEN_SCROLL_PX = 480;

const SignupPopupContext = createContext<(() => void) | null>(null);

/** Returns the function that opens the popup, or null outside the
 * provider (see module doc: callers should fall back to a plain link). */
export function useSignupPopup(): (() => void) | null {
  return useContext(SignupPopupContext);
}

function hasAutoShown(): boolean {
  try {
    return localStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function markAutoShown(): void {
  try {
    localStorage.setItem(SHOWN_KEY, "1");
  } catch {
    // Private mode: it may auto-open again next visit, harmless.
  }
}

export function SignupPopupProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPopup = useCallback(() => setOpen(true), []);
  const closePopup = useCallback(() => setOpen(false), []);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    if (hasAutoShown()) return;

    let scheduled = false;
    function check() {
      scheduled = false;
      if (autoOpenedRef.current) return;
      if (window.scrollY < AUTO_OPEN_SCROLL_PX) return;
      autoOpenedRef.current = true;
      markAutoShown();
      setOpen(true);
      window.removeEventListener("scroll", onScroll);
    }
    function onScroll() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(check);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <SignupPopupContext.Provider value={openPopup}>
      {children}
      <SignupPopupModal open={open} onClose={closePopup} />
    </SignupPopupContext.Provider>
  );
}
