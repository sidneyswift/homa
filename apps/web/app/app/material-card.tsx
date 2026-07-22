"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-sm">
      {showStatusHeadline ? (
        <p className="text-sm font-medium text-[var(--clay-700)]">{headline}</p>
      ) : null}
      <p
        className={`${showStatusHeadline ? "mt-1 " : ""}font-display text-lg font-semibold text-strong`}
      >
        {material.title}
      </p>
      {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      <a
        href={material.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open the ${material.title} PDF`}
        className="mt-3 block overflow-hidden rounded-md border border-border-subtle bg-white transition-shadow hover:shadow-md focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
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
            className="flex min-h-9 min-w-9 items-center justify-center rounded-pill border border-border bg-card text-body transition-colors hover:border-[var(--clay-200)] disabled:opacity-40"
          >
            <ChevronLeft size={16} aria-hidden="true" />
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
            className="flex min-h-9 min-w-9 items-center justify-center rounded-pill border border-border bg-card text-body transition-colors hover:border-[var(--clay-200)] disabled:opacity-40"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <a
        href={material.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-[var(--clay-700)] px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-[var(--clay-600)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none motion-safe:active:scale-[var(--press-scale)]"
      >
        {pageCount > 1 ? `Print all ${pageCount} pages` : "Print it"}
      </a>
    </div>
  );
}
