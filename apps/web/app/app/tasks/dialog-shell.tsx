"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Icon } from "../../../components/design/Icon";
import { QuietFrame } from "../../../components/design/QuietFrame";

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
      data-brand-surface="task-dialog"
      className="quiet-artifact-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <QuietFrame
        as="section"
        className={`quiet-artifact-dialog ${contentClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl font-semibold text-[color:var(--homa-ink)]">
            {heading}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-transparent text-[color:var(--homa-ink)] transition-colors hover:border-[var(--homa-ink)]"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </QuietFrame>
    </div>
  );
}
