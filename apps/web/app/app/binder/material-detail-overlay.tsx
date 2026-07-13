"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { KIND_LABELS, type BinderMaterial } from "../../../lib/materials/binder";

/**
 * The Binder item detail overlay: a bigger look at the real preview plus
 * its metadata, before deciding to print it. Focus-trap and Escape
 * behavior follow the house pattern for "look closer" overlays (first
 * built as the report's ChartLightbox, retired 2026-07-13 when the
 * chart became interactive) rather than inventing a new one.
 * One action on purpose: "Print it" reuses material-card.tsx's own
 * wording, since the PDF link is the same reuse-worthy destination
 * (the browser's own viewer handles print, download, and AirPrint).
 */

function formattedDate(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

export function MaterialDetailOverlay({
  material,
  timeZone,
  onClose,
}: {
  material: BinderMaterial;
  timeZone: string;
  onClose: () => void;
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
      aria-labelledby="binder-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(51,42,33,0.42)] p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-xl)] border border-border-subtle bg-card p-5 shadow-[var(--shadow-xl)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
            {KIND_LABELS[material.kind]}
          </p>
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

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={material.previewUrl}
          alt={`Preview of ${material.title}`}
          className="mx-auto mt-3 block aspect-[8.5/11] w-2/3 rounded-md border border-border-subtle object-cover shadow-sm"
        />

        <h2 id="binder-detail-title" className="mt-4 font-display text-xl font-semibold text-strong">
          {material.title}
        </h2>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-md bg-page p-2.5">
            <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-subtle">
              For
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-strong">
              {material.childName ?? "The whole family"}
            </span>
          </div>
          <div className="rounded-md bg-page p-2.5">
            <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-subtle">
              Kept on
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-strong">
              {formattedDate(material.createdAt, timeZone)}
            </span>
          </div>
          {material.subject ? (
            <div className="col-span-2 rounded-md bg-page p-2.5">
              <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-subtle">
                Subject
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-strong">
                {material.subject}
              </span>
            </div>
          ) : null}
        </div>

        <a
          href={material.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
        >
          Print it
        </a>
      </div>
    </div>
  );
}
