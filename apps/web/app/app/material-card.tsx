"use client";

/**
 * Renders a create_printable result as a card around the real artifact:
 * the JPEG preview of the rendered page, with the PDF one tap away (the
 * browser's PDF viewer handles print/download/AirPrint). The page design
 * is the agent's work end to end; this card only frames it, and the
 * headline follows the material's kind.
 */

export interface MaterialArtifact {
  title: string;
  kind?: string;
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
}

const KIND_HEADLINES: Record<string, string> = {
  worksheet: "Worksheet ready",
  coloring: "Coloring page ready",
  flashcards: "Flash cards ready",
  reader: "Reader ready",
  poster: "Poster ready",
  infographic: "Infographic ready",
  game: "Game ready",
};

export function MaterialCard({
  material,
  showStatusHeadline = true,
}: {
  material: MaterialArtifact;
  showStatusHeadline?: boolean;
}) {
  const headline = KIND_HEADLINES[material.kind ?? ""] ?? "Ready to print";
  const subtitle = [material.skill, material.childName ? `for ${material.childName}` : null]
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
          src={material.previewUrl}
          alt={`Preview of ${material.title}`}
          className="block aspect-[8.5/11] w-full"
          loading="lazy"
        />
      </a>
      <a
        href={material.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 items-center rounded-pill bg-[var(--clay-700)] px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-[var(--clay-600)] focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none motion-safe:active:scale-[var(--press-scale)]"
      >
        Print it
      </a>
    </div>
  );
}
