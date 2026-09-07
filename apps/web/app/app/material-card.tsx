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
      className="quiet-artifact-card quiet-artifact-card--material"
    >
      {showStatusHeadline ? (
        <p className="quiet-artifact-card__headline">{headline}</p>
      ) : null}
      <p className="quiet-artifact-card__title">
        {material.title}
      </p>
      {subtitle ? <p className="quiet-artifact-card__meta">{subtitle}</p> : null}
      {material.sources && material.sources.length > 0 ? (
        <p className="quiet-artifact-card__sources">
          <span className="quiet-artifact-card__sources-label">Made from </span>
          {material.sources.map((source, index) => (
            <span key={source.id}>
              {index > 0 ? ", " : null}
              {source.libraryUrl ? (
                <a
                  href={source.libraryUrl}
                  className="quiet-artifact-card__source-link"
                >
                  {source.title}
                </a>
              ) : (
                source.title
              )}
              {source.sourceLocator ? ` · ${source.sourceLocator}` : null}
            </span>
          ))}
        </p>
      ) : null}
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open the ${material.title} PDF`}
        className="quiet-artifact-card__preview"
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
          className="quiet-artifact-card__image"
          loading="lazy"
        />
      </a>
      {pagePreviews.length > 1 ? (
        <div className="quiet-artifact-card__pager">
          <button
            type="button"
            onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
            disabled={pageIndex === 0}
            aria-label="Previous page"
            className="quiet-action quiet-action--secondary quiet-artifact-card__pager-button"
          >
            <Icon name="back" size={16} />
          </button>
          <span aria-live="polite" className="quiet-artifact-card__pager-label">
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
            className="quiet-action quiet-action--secondary quiet-artifact-card__pager-button"
          >
            <Icon name="next" size={16} />
          </button>
        </div>
      ) : null}
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        className="quiet-action quiet-action--primary quiet-artifact-card__print-action"
      >
        {pageCount > 1 ? `Open all ${pageCount} pages to print` : "Open PDF to print"}
      </a>
    </div>
  );
}
