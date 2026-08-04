"use client";

import React, { useEffect, useRef } from "react";

/**
 * SidePanel: the one modal-sheet chassis
 * (plans/2026-07-21-chat-first-onboarding.md §2.7), extracted from
 * ProgressDetailPanel (the fit donor, components/progress/progress-detail-panel.tsx).
 * Mobile bottom sheet (max-h-[78dvh], rounded top, stone grabber),
 * desktop right sheet (min(440px,92vw)), scrim, Escape + scrim close,
 * focus trap, @starting-style translate entrance, motion-reduce
 * opt-out. The chat surface behind it is deliberately left alone: this
 * is a sheet beside the conversation, never a takeover that hides it.
 *
 * Owns geometry and dismissal only. Every caller renders its own
 * header, body, and footer as children, because what a panel says
 * varies enormously (a progress subject's domains, a week board, a
 * planner canvas) and locking that down here would re-fight a battle
 * this chassis was never meant to fight.
 */
export function SidePanel({
  labelledBy,
  onClose,
  initialFocusRef,
  variant = "legacy",
  detent = "resting",
  children,
}: {
  /** The id of the caller's own heading element, for aria-labelledby. */
  labelledBy: string;
  onClose: () => void;
  /** Focused on mount instead of the dialog shell itself, for a caller
   * that wants a specific control (e.g. an explicit Close button)
   * under the user's finger first. Omit for the dialog-level default,
   * which still moves focus into the panel. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Library opts into Quiet authority while older sheet consumers migrate. */
  variant?: "legacy" | "quiet";
  /** Quiet phone sheets start at the resting detent and may expand later. */
  detent?: "resting" | "expanded";
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (initialFocusRef?.current ?? dialogRef.current)?.focus();

    function focusableElements(): HTMLElement[] {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.tabIndex >= 0);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!active || !dialogRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, initialFocusRef]);

  return (
    <>
      {/* Tap-catch scrim: any tap outside the panel closes it. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={
          variant === "quiet"
            ? "quiet-context-sheet__scrim print:hidden"
            : "fixed inset-0 z-40 bg-[rgba(51,42,33,0.42)] transition-opacity duration-(--dur-base) ease-out starting:opacity-0 motion-reduce:transition-none print:hidden"
        }
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={
          variant === "quiet"
            ? "quiet-context-sheet"
            : "fixed inset-x-0 bottom-0 z-50 flex max-h-[78dvh] flex-col rounded-t-[var(--radius-xl)] border-t border-border-subtle bg-card shadow-[var(--shadow-xl)] transition-[translate] duration-(--dur-base) ease-out starting:translate-y-full motion-reduce:transition-none focus:outline-none lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:max-h-none lg:w-[min(440px,92vw)] lg:rounded-l-[var(--radius-xl)] lg:rounded-tr-none lg:border-l lg:border-t-0 lg:starting:translate-x-full lg:starting:translate-y-0"
        }
        data-context-panel={variant === "quiet" ? "" : undefined}
        data-context-mode={variant === "quiet" ? "sheet" : undefined}
        data-detent={variant === "quiet" ? detent : undefined}
      >
        {/* The sheet's grabber, phones only: says "this slides away". */}
        <span
          aria-hidden="true"
          className={
            variant === "quiet"
              ? "quiet-context-sheet__grabber"
              : "mx-auto mt-2.5 block h-1.5 w-10 shrink-0 rounded-pill bg-[var(--stone-300)] lg:hidden"
          }
        />
        {children}
      </div>
    </>
  );
}
