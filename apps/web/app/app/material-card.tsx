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

export function MaterialCard({ material }: { material: MaterialArtifact }) {
  const headline = KIND_HEADLINES[material.kind ?? ""] ?? "Ready to print";
  const subtitle = [material.skill, material.childName ? `for ${material.childName}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm font-medium text-brand">{headline}</p>
      <p className="mt-1 font-display text-lg font-semibold text-strong">
        {material.title}
      </p>
      {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      <a
        href={material.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open the ${material.title} PDF`}
        className="mt-3 block overflow-hidden rounded-md border border-border-subtle bg-white transition-shadow hover:shadow-md"
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
        className="mt-4 inline-block rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
      >
        Print it
      </a>
    </div>
  );
}
