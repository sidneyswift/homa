"use client";

import { useState } from "react";

import type { FamilyAssetReference } from "../../lib/library/family-asset-reference";
import { Icon } from "../../components/design/Icon";

/**
 * Renders a create_printable result as a card around the real artifact:
 * the JPEG preview of the rendered page, with the PDF one tap away (the
 * browser's PDF viewer handles print/download/AirPrint). The page design
 * is the agent's work end to end; this card only frames it, and the
 * headline follows the material's kind.
 *
 * Packets (multi-page materials, 2026-07-17) page through their real
 * per-page previews right on the card, so a parent can see every page
 * she is about to print without opening the PDF. One file, one print.
 */

export interface MaterialArtifact {
  /** Absent only for pre-2026-07-25 reconstructed cards with no real id
   * to attribute a beacon to; those fall back to the raw pdfUrl link. */
  id?: string;
  title: string;
  kind?: string;
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  /** PDF pages; absent or 1 on classic single-page materials. */
  pageCount?: number;
  /** Per-page previews (page 1 first) when more than one page exists. */
  pagePreviewUrls?: string[];
  /** Family Library sources Homa used to make this artifact. */
  sources?: FamilyAssetReference[];
}

const KIND_HEADLINES: Record<string, string> = {
  worksheet: "Worksheet ready",
  coloring: "Coloring page ready",
  flashcards: "Flash cards ready",
  reader: "Reader ready",
  poster: "Poster ready",
  infographic: "Infographic ready",
  game: "Game ready",
  packet: "Packet ready",
};

export function MaterialCard({
  material,
  showStatusHeadline = true,
}: {
  material: MaterialArtifact;
  showStatusHeadline?: boolean;
}) {
  const headline = KIND_HEADLINES[material.kind ?? ""] ?? "Ready to print";
  // Routed through the pdf_opened beacon when a real id exists (records
  // that a parent's own click reached this material, the funnel's
  // missing terminal event); otherwise the raw Blob URL, unchanged.
  const pdfHref = material.id
    ? `/api/materials/${material.id}/pdf`
    : material.pdfUrl;
  const pageCount = material.pageCount ?? 1;
  const pagePreviews =
    material.pagePreviewUrls && material.pagePreviewUrls.length > 1
      ? material.pagePreviewUrls
      : [material.previewUrl];
  const [pageIndex, setPageIndex] = useState(0);
  const currentPreview = pagePreviews[Math.min(pageIndex, pagePreviews.length - 1)];
  const subtitle = [
    pageCount > 1 ? `${pageCount} pages, one PDF` : null,
    material.skill,
    material.childName ? `for ${material.childName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      data-brand-layer="material-card"
      className="quiet-artifact-card w-full max-w-sm border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] p-4 shadow-sm"
    >
      {showStatusHeadline ? (
        <p className="text-sm font-medium text-[var(--homa-brand-text)]">{headline}</p>
      ) : null}
      <p
        className={`${showStatusHeadline ? "mt-1 " : ""}font-display text-lg font-semibold text-strong`}
      >
        {material.title}
      </p>
      {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      {material.sources && material.sources.length > 0 ? (
        <p className="mt-1.5 text-xs text-subtle">
          <span className="font-medium">Made from </span>
          {material.sources.map((source, index) => (
            <span key={source.id}>
              {index > 0 ? ", " : null}
              {source.libraryUrl ? (
                <a
                  href={source.libraryUrl}
                  className="underline decoration-[var(--homa-control-boundary)] underline-offset-2 hover:text-[var(--homa-ink)]"
                >
                  {source.title}
                </a>
              ) : (
                source.title
              )}
            </span>
          ))}
        </p>
      ) : null}
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open the ${material.title} PDF`}
        className="quiet-artifact-card__preview mt-3 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--homa-visual-coral)]"
      >
        {/* Plain img on purpose: blob previews are remote, sized by the
            letter aspect ratio, and never above the fold. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentPreview}
          alt={
            pagePreviews.length > 1
              ? `Preview of ${material.title}, page ${pageIndex + 1} of ${pageCount}`
              : `Preview of ${material.title}`
          }
          className="block aspect-[8.5/11] w-full"
          loading="lazy"
        />
      </a>
      {pagePreviews.length > 1 ? (
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
            disabled={pageIndex === 0}
            aria-label="Previous page"
            className="quiet-action quiet-action--secondary min-h-9 min-w-9 px-2 text-body disabled:opacity-40"
          >
            <Icon name="back" size={16} />
          </button>
          <span aria-live="polite" className="text-xs font-semibold text-muted">
            Page {pageIndex + 1} of {pageCount}
            {pageCount > pagePreviews.length ? ` · previews show the first ${pagePreviews.length}` : ""}
          </span>
          <button
            type="button"
            onClick={() =>
              setPageIndex((index) => Math.min(pagePreviews.length - 1, index + 1))
            }
            disabled={pageIndex >= pagePreviews.length - 1}
            aria-label="Next page"
            className="quiet-action quiet-action--secondary min-h-9 min-w-9 px-2 text-body disabled:opacity-40"
          >
            <Icon name="next" size={16} />
          </button>
        </div>
      ) : null}
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        className="quiet-action quiet-action--primary mt-4 min-h-11 px-5 py-2.5 text-sm shadow-sm"
      >
        {pageCount > 1 ? `Print all ${pageCount} pages` : "Print it"}
      </a>
    </div>
  );
}
