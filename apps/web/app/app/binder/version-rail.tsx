"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { MaterialVersion } from "../../../lib/materials/history";
import {
  materialVersionsAction,
  restoreMaterialVersionAction,
} from "./version-history-action";

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
  const router = useRouter();
  const [isRestoring, startRestore] = useTransition();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);
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
  const current = versions.find((version) => version.isCurrent) ?? null;

  function restore(version: MaterialVersion) {
    setRestoreNote(null);
    setRestoringId(version.id);
    startRestore(async () => {
      try {
        const result = await restoreMaterialVersionAction(materialId, version.id);
        setRestoreNote(result.note);
        if (result.restored) router.refresh();
      } catch {
        setRestoreNote("I could not bring that version back. Nothing changed. Try again in a moment.");
      } finally {
        setRestoringId(null);
      }
    });
  }

  return (
    <section className="mt-4" aria-labelledby="version-rail-heading">
      <h3
        id="version-rail-heading"
        className="font-mono text-[0.6rem] uppercase tracking-widest text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]"
      >
        Earlier versions
      </h3>
      <p className="mt-1 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_64%,var(--homa-canvas))]">
        Bring one back without deleting the versions you made after it.
      </p>
      {withImages.length > 0 ? (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {withImages.map((version) => (
            <li key={version.id} className="w-28 shrink-0">
              <a
                href={version.previewUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                aria-label={`Version ${version.ordinal}, open the full-size preview`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={version.previewUrl ?? ""}
                  alt={`Version ${version.ordinal}`}
                  className="block h-24 w-full rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-paper)] object-cover"
                  loading="lazy"
                />
              </a>
              <span className="mt-1 block text-center text-[0.65rem] text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                {`Version ${version.ordinal}`}
              </span>
              <button
                type="button"
                onClick={() => restore(version)}
                disabled={isRestoring}
                className="quiet-action mt-1 w-full justify-center px-2 py-1 text-[0.65rem]"
              >
                {restoringId === version.id ? "Bringing it back…" : "Bring back"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1.5 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
        {current
          ? `Version ${current.ordinal} is the one you are using now. You and Homa made ${versions.length} versions together.`
          : `You and Homa made ${versions.length} versions together.`}
        {reclaimed > 0
          ? ` ${reclaimed === 1 ? "One older version no longer has" : `${reclaimed} older versions no longer have`} a preview.`
          : null}
      </p>
      {restoreNote ? (
        <p className="mt-2 text-xs text-[color:var(--homa-ink)]" role="status">
          {restoreNote}
        </p>
      ) : null}
    </section>
  );
}
