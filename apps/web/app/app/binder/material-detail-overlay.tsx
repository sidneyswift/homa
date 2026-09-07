"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "../../../components/design/Icon";
import { QuietAction } from "../../../components/design/QuietAction";
import { QuietFrame } from "../../../components/design/QuietFrame";
import { KIND_LABELS, subjectLabel, type BinderMaterial } from "../../../lib/materials/binder";
import { deleteMaterialAction } from "./delete-material-action";
import { VersionRail } from "./version-rail";

/**
 * The Binder item detail overlay: a bigger look at the real preview plus
 * its metadata, before deciding to print it. Focus-trap and Escape
 * behavior follow the house pattern for "look closer" overlays (first
 * built as the report's ChartLightbox, retired 2026-07-13 when the
 * chart became interactive) rather than inventing a new one.
 * One action on purpose: "Print it" reuses material-card.tsx's own
 * wording, since the PDF link is the same reuse-worthy destination
 * (the browser's own viewer handles print, download, and AirPrint).
 * Packets page through their per-page previews here, same pattern as
 * the chat card.
 */

/**
 * Two-step delete confirm (Carolyng feedback, 2026-08-27): "We should be
 * able to delete in progress and saved items from binder." Same
 * reveal-a-confirm-row shape as the Hours page's own DeleteEntryButton,
 * so the pattern reads the same wherever an /app surface offers it.
 */
function DeleteMaterialControl({ material, onDeleted }: { material: BinderMaterial; onDeleted: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="quiet-action quiet-action--quiet mt-2 min-h-9 px-0 text-xs text-[color:var(--homa-error-ink)]"
      >
        Delete this
      </button>
    );
  }

  return (
    <div className="mt-3 border-t border-[var(--homa-control-boundary)] pt-3">
      <p className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
        {`Delete "${material.title}" from your binder?`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <QuietAction
          kind="secondary"
          disabled={pending}
          className="px-3.5 text-xs text-[color:var(--homa-error-ink)]"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const result = await deleteMaterialAction(material.id);
                if (result.deleted) {
                  onDeleted();
                  router.refresh();
                } else {
                  setError(result.note);
                }
              } catch {
                setError("That did not delete. Try again in a moment.");
              }
            });
          }}
        >
          {pending ? "Deleting…" : "Delete"}
        </QuietAction>
        <QuietAction kind="quiet" disabled={pending} onClick={() => setConfirming(false)} className="px-3.5 text-xs">
          Cancel
        </QuietAction>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-[color:var(--homa-error-ink)]">{error}</p> : null}
    </div>
  );
}

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
  const pagePreviews =
    material.pagePreviewUrls && material.pagePreviewUrls.length > 1
      ? material.pagePreviewUrls
      : [material.previewUrl];
  const [pageIndex, setPageIndex] = useState(0);
  const currentPreview = pagePreviews[Math.min(pageIndex, pagePreviews.length - 1)];

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
      className="quiet-artifact-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <QuietFrame
        as="section"
        className="quiet-artifact-dialog relative"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
            {KIND_LABELS[material.kind]}
          </p>
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

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentPreview}
          alt={
            pagePreviews.length > 1
              ? `Preview of ${material.title}, page ${pageIndex + 1} of ${material.pageCount}`
              : `Preview of ${material.title}`
          }
          className="mx-auto mt-3 block aspect-[8.5/11] w-2/3 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] object-cover shadow-sm"
        />
        {pagePreviews.length > 1 ? (
          <div className="mx-auto mt-2 flex w-2/3 items-center justify-between">
            <button
              type="button"
              onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
              disabled={pageIndex === 0}
              aria-label="Previous page"
              className="grid h-11 w-11 place-items-center rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] text-[color:var(--homa-ink)] transition-colors hover:border-[var(--homa-midnight-action)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="back" size={16} />
            </button>
            <span aria-live="polite" className="text-xs font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
              Page {pageIndex + 1} of {material.pageCount}
            </span>
            <button
              type="button"
              onClick={() =>
                setPageIndex((index) => Math.min(pagePreviews.length - 1, index + 1))
              }
              disabled={pageIndex >= pagePreviews.length - 1}
              aria-label="Next page"
              className="grid h-11 w-11 place-items-center rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] text-[color:var(--homa-ink)] transition-colors hover:border-[var(--homa-midnight-action)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="next" size={16} />
            </button>
          </div>
        ) : null}

        <h2 id="binder-detail-title" className="mt-4 font-display text-xl font-semibold text-[color:var(--homa-ink)]">
          {material.title}
        </h2>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="quiet-artifact-meta">
            <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
              For
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-[color:var(--homa-ink)]">
              {material.childName ?? "The whole family"}
            </span>
          </div>
          <div className="quiet-artifact-meta">
            <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
              Kept on
            </span>
            <span className="mt-0.5 block text-sm font-semibold text-[color:var(--homa-ink)]">
              {formattedDate(material.createdAt, timeZone)}
            </span>
          </div>
          {material.subject ? (
            <div className="quiet-artifact-meta col-span-2">
              <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                Subject
              </span>
              <span className="mt-0.5 block text-sm font-semibold text-[color:var(--homa-ink)]">
                {subjectLabel(material.subject)}
              </span>
            </div>
          ) : null}
        </div>

        {material.sources.length > 0 ? (
          <div className="quiet-artifact-meta mt-3">
            <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
              Made from
            </span>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm">
              {material.sources.map((source) =>
                source.libraryUrl ? (
                  <a
                    key={source.id}
                    href={source.libraryUrl}
                    className="font-semibold text-[color:var(--homa-ink)] underline decoration-[var(--homa-control-boundary)] underline-offset-2 hover:text-[color:var(--homa-brand-text)]"
                  >
                    {source.title}{source.sourceLocator ? ` · ${source.sourceLocator}` : null}
                  </a>
                ) : (
                  <span key={source.id} className="font-semibold text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
                    {source.title}{source.sourceLocator ? ` · ${source.sourceLocator}` : null}
                  </span>
                ),
              )}
            </div>
          </div>
        ) : null}

        <a
          href={`/api/materials/${material.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="quiet-action quiet-action--primary mt-4"
        >
          <span>{material.pageCount > 1 ? `Open all ${material.pageCount} pages to print` : "Open PDF to print"}</span>
          <span className="quiet-action__icon" aria-hidden="true"><Icon name="print" size={20} /></span>
        </a>

        <a
          href={`/app?draft=revise-material&material=${encodeURIComponent(material.id)}`}
          className="quiet-action quiet-action--secondary mt-2"
        >
          <span>Change this with Homa</span>
          <span className="quiet-action__icon" aria-hidden="true"><Icon name="chat" size={20} /></span>
        </a>

        <VersionRail materialId={material.id} />

        <DeleteMaterialControl material={material} onDeleted={onClose} />
      </QuietFrame>
    </div>
  );
}
