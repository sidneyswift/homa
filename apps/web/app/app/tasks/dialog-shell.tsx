"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * The centered modal shell for the Tasks surface: backdrop, focus trap,
 * Escape-to-close, the heading row and its close button. Extracted from
 * TaskEditOverlay so the agent-jobs overlay reuses the exact same behavior
 * and DOM contract instead of copying forty lines of focus-trap wiring.
 * Focus and Escape mirror the Binder's MaterialDetailOverlay, the house
 * pattern for centered dialogs. Body content is the caller's children.
 */
export function DialogShell({
  titleId,
  heading,
  onClose,
  children,
  contentClassName = "max-w-md",
}: {
  titleId: string;
  heading: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Width class for the inner card; defaults to the editor's max-w-md. */
  contentClassName?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    function focusableElements(): HTMLElement[] {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,42,33,0.42)] p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full ${contentClassName} overflow-y-auto rounded-[var(--radius-xl)] border border-border-subtle bg-card p-5 shadow-[var(--shadow-xl)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl font-semibold text-strong">
            {heading}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-subtle transition-colors duration-(--dur-fast) ease-out hover:bg-page hover:text-body"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
