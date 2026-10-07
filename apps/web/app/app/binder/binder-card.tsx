"use client";

import { KIND_LABELS, type BinderMaterial } from "../../../lib/materials/binder";

/**
 * One Binder item: Direction 2's large real preview image (a plain
 * `<img>` of the same JPEG material-card.tsx already renders, not a
 * placeholder icon, since the Binder has real artifacts to show) plus
 * Direction 1's plain, human caption underneath. A button, not a link:
 * it opens the detail overlay rather than navigating away.
 */

const KIND_TONES: ReadonlyArray<readonly [string, string]> = [
  ["var(--homa-error-tint)", "var(--homa-brand-text)"],
  ["var(--homa-constructive-tint)", "var(--homa-constructive-ink)"],
  ["var(--homa-highlight-tint)", "var(--homa-highlight-ink)"],
  ["var(--homa-info-tint)", "var(--homa-info-ink)"],
];

const KIND_ORDER = Object.keys(KIND_LABELS);

function kindTone(kind: string): readonly [string, string] {
  const index = Math.max(0, KIND_ORDER.indexOf(kind));
  return KIND_TONES[index % KIND_TONES.length];
}

export function BinderCard({
  material,
  onOpen,
  compact = false,
}: {
  compact?: boolean;
  material: BinderMaterial;
  onOpen: (material: BinderMaterial) => void;
}) {
  const [chipBg, chipInk] = kindTone(material.kind);
  if (compact) return <button type="button" onClick={() => onOpen(material)} aria-label={`${material.title}. View and print.`}
    className="flex min-h-14 w-full items-center gap-4 border-b border-[var(--homa-control-boundary)] py-3 text-left">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={material.previewUrl} alt="" width={48} height={64} loading="lazy" className="h-16 w-12 shrink-0 object-contain" />
    <span className="min-w-0"><span className="block font-semibold text-[var(--homa-ink)]">{material.title}</span>
      <span className="mt-1 block text-sm text-[var(--homa-muted-ink)]">{material.childName ?? "Whole family"} · {KIND_LABELS[material.kind]}{material.pageCount > 1 ? ` · ${material.pageCount} pages` : ""}</span>
    </span>
  </button>;
  return (
    <button
      type="button"
      onClick={() => onOpen(material)}
      aria-label={`${material.title}. View and print.`}
      className="quiet-artifact-card"
    >
      <span className="quiet-artifact-card__preview block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={material.previewUrl}
          alt={`Preview of ${material.title}`}
          className="block aspect-[8.5/11] w-full object-cover"
          loading="lazy"
        />
      </span>
      <span className="mt-2 block truncate font-semibold text-[color:var(--homa-ink)]">{material.title}</span>
      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
        <span
          className="rounded-[var(--homa-radius-control)] px-2 py-0.5 text-[0.65rem] font-bold"
          style={{ background: chipBg, color: chipInk }}
        >
          {KIND_LABELS[material.kind]}
        </span>
        <span>{material.childName ?? "Family"}</span>
        {material.pageCount > 1 ? <span>· {material.pageCount} pages</span> : null}
      </span>
    </button>
  );
}
