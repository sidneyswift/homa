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
  ["var(--clay-50)", "var(--clay-700)"],
  ["var(--sage-50)", "var(--sage-700)"],
  ["var(--gold-100)", "var(--gold-ink)"],
  ["var(--sky-100)", "var(--sky-600)"],
];

const KIND_ORDER = Object.keys(KIND_LABELS);

function kindTone(kind: string): readonly [string, string] {
  const index = Math.max(0, KIND_ORDER.indexOf(kind));
  return KIND_TONES[index % KIND_TONES.length];
}

export function BinderCard({
  material,
  onOpen,
}: {
  material: BinderMaterial;
  onOpen: (material: BinderMaterial) => void;
}) {
  const [chipBg, chipInk] = kindTone(material.kind);
  return (
    <button
      type="button"
      onClick={() => onOpen(material)}
      aria-label={`${material.title}. View and print.`}
      className="group block w-full rounded-[var(--radius-lg)] text-left transition-transform duration-(--dur-fast) ease-out motion-safe:hover:-translate-y-0.5"
    >
      <span className="block overflow-hidden rounded-lg border border-border-subtle bg-white shadow-sm transition-shadow group-hover:shadow-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={material.previewUrl}
          alt={`Preview of ${material.title}`}
          className="block aspect-[8.5/11] w-full object-cover"
          loading="lazy"
        />
      </span>
      <span className="mt-2 block truncate font-semibold text-strong">{material.title}</span>
      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle">
        <span
          className="rounded-pill px-2 py-0.5 text-[0.65rem] font-bold"
          style={{ background: chipBg, color: chipInk }}
        >
          {KIND_LABELS[material.kind]}
        </span>
        <span>{material.childName ?? "Family"}</span>
      </span>
    </button>
  );
}
