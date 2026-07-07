"use client";

import { ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "./ds/Button";

/**
 * Scroll-triggered nudge card, replacing the invite-only InviteBand section
 * (founder call 2026-07-07: no more invite-only framing on the homepage).
 * Slides in once a reader has scrolled past the sentinel below (engaged
 * with the page, not just landed) and hides again whenever CtaBand's
 * `data-final-cta` section is on screen, so the nudge never doubles up
 * with the page's own closing CTA; it reappears if they scroll back up
 * away from it, since the reminder is relevant again. Dismissal is
 * remembered for 30 days.
 *
 * Dismissal is read through useSyncExternalStore, the same localStorage
 * pattern as plan-weeks.tsx: hydration-safe by construction (the server
 * snapshot is null) and no setState-in-effect cascade.
 */

const DISMISS_KEY = "homa_scroll_cta_dismissed_at";
const DISMISS_COOLDOWN_DAYS = 30;

const dismissListeners = new Set<() => void>();

function subscribeToDismissal(callback: () => void): () => void {
  dismissListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    dismissListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readDismissedAt(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    // Private mode: the dismissal just won't persist.
    return null;
  }
}

function isWithinCooldown(dismissedAt: string | null): boolean {
  if (!dismissedAt) return false;
  const daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_COOLDOWN_DAYS;
}

/**
 * Geometry, not IntersectionObserver: a threshold-crossing observer never
 * fires for a scroll that jumps clean over the "intersecting" frame (a
 * fast flick, Page Down, or landing mid-page from back/forward cache), so
 * `visible` could get stuck forever. Reading current positions on every
 * scroll tick is slightly more work but always correct.
 */
function computeVisible(sentinel: Element, finalCta: Element | null): boolean {
  const scrolledPastSentinel = sentinel.getBoundingClientRect().top < 0;
  if (!scrolledPastSentinel) return false;
  if (finalCta && finalCta.getBoundingClientRect().top < window.innerHeight) return false;
  return true;
}

export function ScrollCta() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const rawDismissedAt = useSyncExternalStore(subscribeToDismissal, readDismissedAt, () => null);
  const dismissed = useMemo(() => isWithinCooldown(rawDismissedAt), [rawDismissedAt]);

  useEffect(() => {
    if (dismissed) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const finalCta = document.querySelector("[data-final-cta]");

    let scheduled = false;
    const check = () => {
      scheduled = false;
      setVisible(computeVisible(sentinel, finalCta));
    };
    const onScrollOrResize = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(check);
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    // Covers loading already scrolled (hash link, back/forward cache restore).
    onScrollOrResize();

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [dismissed]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Private browsing or storage disabled: the card just won't remember, no harm done.
    }
    dismissListeners.forEach((listener) => listener());
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, dismiss]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {!dismissed && (
        <div
          role="region"
          aria-label="Get your child's free progress report"
          data-visible={visible}
          className="scroll-cta"
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="scroll-cta-close"
          >
            <X size={15} aria-hidden="true" />
          </button>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-strong)", margin: "0 28px 6px 0" }}>
            Not sure where to start?
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 16px" }}>
            A few quick questions get you a free report on exactly what your child needs next.
          </p>
          <Button variant="primary" size="sm" fullWidth href="/onboarding" iconRight={<ArrowRight size={16} color="#fff" aria-hidden="true" />}>
            See where your child stands
          </Button>
        </div>
      )}
    </>
  );
}
