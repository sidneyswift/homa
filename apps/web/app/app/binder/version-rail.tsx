"use client";

import { useEffect, useState } from "react";

import type { MaterialVersion } from "../../../lib/materials/history";
import { materialVersionsAction } from "./version-history-action";

/**
 * Every version of this material, oldest first (gh#350).
 *
 * "As soon as she redoes it I can't see the old version, so I have to
 * start screenshotting." The rows were always there; there was nowhere
 * to look at them, and until 2026-07-29 finalize deleted each superseded
 * version's image so there would have been nothing to show anyway.
 *
 * Voice: this is a keepsake, not an audit trail. No "superseded", no
 * "rejected", no version numbers dressed up as failures. She made these
 * in order; that is all this says.
 */
export function VersionRail({ materialId }: { materialId: string }) {
  // Keyed by the material it loaded for, rather than reset synchronously
  // inside the effect: clearing state during an effect cascades a render,
  // and stale history flashing under a newly opened material is exactly
  // the confusion this rail exists to remove.
  const [loaded, setLoaded] = useState<{
    materialId: string;
    versions: MaterialVersion[];
  } | null>(null);

  useEffect(() => {
    let live = true;
    materialVersionsAction(materialId)
      .then((versions) => {
        if (live) setLoaded({ materialId, versions });
      })
      .catch(() => {
        if (live) setLoaded({ materialId, versions: [] });
      });
    return () => {
      live = false;
    };
  }, [materialId]);

  const versions = loaded?.materialId === materialId ? loaded.versions : null;

  // One version is not a history worth showing, and neither is a failed
  // lookup: the page is about the material, not about this rail.
  if (versions === null || versions.length < 2) return null;

  const earlier = versions.filter((version) => !version.isCurrent);
  const withImages = earlier.filter((version) => version.previewUrl !== null);
  const reclaimed = earlier.length - withImages.length;

  return (
    <section className="mt-4" aria-labelledby="version-rail-heading">
      <h3
        id="version-rail-heading"
        className="font-mono text-[0.6rem] uppercase tracking-widest text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]"
      >
        Earlier tries
      </h3>
      {withImages.length > 0 ? (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {withImages.map((version) => (
            <li key={version.id} className="shrink-0">
              <a
                href={version.previewUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                aria-label={`Version ${version.ordinal}, open the full picture`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={version.previewUrl ?? ""}
                  alt={`Version ${version.ordinal}`}
                  className="block h-24 w-[74px] rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] object-cover"
                  loading="lazy"
                />
              </a>
              <span className="mt-1 block text-center text-[0.65rem] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                {version.ordinal}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1.5 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
        {`You and Homa made ${versions.length} versions of this together.`}
        {reclaimed > 0
          ? ` ${reclaimed === 1 ? "One older picture is" : `${reclaimed} older pictures are`} no longer saved.`
          : null}
      </p>
    </section>
  );
}
