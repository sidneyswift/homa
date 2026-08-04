"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { SignupPopupModal } from "./SignupPopupModal";

/**
 * Landing-page signup popup, shared across Nav, Hero, proof, and CtaBand so
 * there's exactly one modal instance and one source of truth for whether
 * it's open. `useSignupPopup()` returns null outside this provider (Nav
 * also renders on /onboarding and /blog, where "Sign up" should keep
 * navigating straight to /onboarding instead), so every call site falls
 * back to its old link behavior when the popup isn't available.
 *
 * The 2026-07-15 category page opens the popup only through explicit actions.
 * Promoting the sample report into the page makes a scroll interruption
 * redundant and lets the reader inspect proof before entering family data.
 */

type SignupPopupOpener = (event?: ReactMouseEvent<HTMLElement>) => void;

const SignupPopupContext = createContext<SignupPopupOpener | null>(null);

/** Returns the function that opens the popup, or null outside the
 * provider (see module doc: callers should fall back to a plain link). */
export function useSignupPopup(): SignupPopupOpener | null {
  return useContext(SignupPopupContext);
}

export function SignupPopupProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openPopup = useCallback<SignupPopupOpener>((event) => {
    returnFocusRef.current = event?.currentTarget
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setOpen(true);
  }, []);
  const closePopup = useCallback(() => {
    const returnFocus = returnFocusRef.current;
    setOpen(false);
    // React removes the dialog during this event. Restore on the next
    // frame so the browser cannot move focus back to body as the focused
    // dialog node disappears. preventScroll keeps the reader's place.
    window.requestAnimationFrame(() => {
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocusRef.current = null;
    });
  }, []);

  return (
    <SignupPopupContext.Provider value={openPopup}>
      {children}
      <SignupPopupModal open={open} onClose={closePopup} />
    </SignupPopupContext.Provider>
  );
}
