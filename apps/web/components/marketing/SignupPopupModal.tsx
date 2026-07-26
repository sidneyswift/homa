"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { ParentStep } from "../../app/onboarding/parent-step";
import { readUtmFromLocation } from "../../lib/waitlist-client";

/**
 * The landing page's signup popup. Renders the onboarding flow's own entry
 * step (ParentStep, S1) inside a wide dialog instead of a second copy of
 * the same design, so the popup and the real /onboarding entry can never
 * drift apart. Submitting claims the email through the same
 * /api/map/claim call ParentStep already makes; onDone closes the popup
 * and sends her into /onboarding, which resumes past the email step
 * automatically (MapFlow reads the resume cookie this popup just set and
 * routes straight to "kids").
 *
 * Entrance animation is pure CSS (@starting-style on .signup-popup-*,
 * globals.css), the modern replacement for the "set mounted state in an
 * effect after first render" trick; nothing here needs to call setState
 * from an effect body just to animate its own arrival.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SignupPopupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Bootstrap the anonymous session up front so the form's first submit
    // never races an unclaimed family (mirrors MapFlow's own
    // bootstrapSession call before it shows this same step).
    void fetch("/api/map/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "organic", utm: readUtmFromLocation() }),
    }).catch(() => {
      // Best-effort: a failed bootstrap here just means the claim call
      // below falls through to ParentStep's own offline-queue fallback.
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Focus management (a dialog without it strands keyboard and screen
  // reader users on the dimmed page): focus moves to the card on open,
  // Tab cycles inside it, and closing hands focus back to the CTA that
  // opened it.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cardRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const focusables = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !card.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && (active === first || active === card)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="signup-popup-overlay" onClick={onClose}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Get your child's free progress report"
        className="signup-popup-card"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="signup-popup-close">
          <X size={18} aria-hidden="true" />
        </button>
        <ParentStep
          onDone={() => {
            onClose();
            router.push("/onboarding");
          }}
        />
      </div>
    </div>
  );
}
