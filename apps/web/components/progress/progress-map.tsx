"use client";

import { useEffect, useRef, useState } from "react";

import type { ProgressTileModel } from "../../lib/child-progress/map-model";
import type {
  OpenProgressConflictView,
  ProgressSubjectView,
} from "../../lib/child-progress/types";
import { progressSubjectHeadline } from "../../lib/child-progress/view-copy";
import { ProgressDetailPanel } from "./progress-detail-panel";

/**
 * The Progress map, the page's no-chart fallback (2026-07-13 merge:
 * once a scoring exists the snapshot card's legend rows are the
 * subject-by-subject list, see ProgressSubjects). Before the first
 * scoring this grid keeps every subject's door: one tile per subject,
 * tap to open that subject's domains and topics in a detail panel.
 * Everything it renders arrives as serializable props.
 */

const TILE_DOT_TONES: Record<
  NonNullable<ProgressTileModel["freshness"]>["kind"],
  string
> = {
  today: "var(--sage-500)",
  recent: "var(--stone-300)",
  quiet: "var(--gold-400)",
};

export function ProgressMap({
  childId,
  tiles,
  subjects,
  conflicts,
  timeZone,
  deeperChecks,
}: {
  childId: string;
  tiles: ProgressTileModel[];
  subjects: ProgressSubjectView[];
  conflicts: readonly OpenProgressConflictView[];
  timeZone: string;
  /** False on read-only mirrors: hides the panel's deep-dive door. */
  deeperChecks: boolean;
}) {
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // A full-height panel over a scrolled page: the page underneath stays
  // put while the panel is up (same rule as the phone nav drawer).
  useEffect(() => {
    if (openSubjectId === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [openSubjectId]);

  const openSubject =
    openSubjectId === null
      ? null
      : (subjects.find((subject) => subject.subjectId === openSubjectId) ??
        null);
  const openTile =
    openSubjectId === null
      ? null
      : (tiles.find((tile) => tile.subjectId === openSubjectId) ?? null);

  function closePanel() {
    setOpenSubjectId(null);
    triggerRef.current?.focus();
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.subjectId} className="flex">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={openSubjectId === tile.subjectId}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setOpenSubjectId(tile.subjectId);
              }}
              className="flex min-h-[106px] w-full flex-col items-start gap-1.5 rounded-lg border border-border-subtle bg-card p-3.5 text-left shadow-sm transition-colors duration-(--dur-fast) ease-out hover:border-[var(--clay-300)]"
            >
              <span className="flex flex-wrap items-center gap-1.5 font-display text-[0.95rem] font-semibold leading-tight text-strong">
                {tile.displayName}
                {tile.needsConfirm ? (
                  <span className="rounded-pill bg-[var(--gold-100)] px-2 py-0.5 text-[0.68rem] font-bold text-[var(--gold-ink)]">
                    {progressSubjectHeadline("conflict")}
                  </span>
                ) : null}
              </span>
              <span className="mt-auto flex flex-wrap gap-1.5">
                {tile.badge ? (
                  <span
                    className="rounded-pill px-2.5 py-1 text-[0.75rem] font-bold"
                    style={{
                      background: tile.badge.background,
                      color: tile.badge.color,
                    }}
                  >
                    {tile.badge.label}
                  </span>
                ) : null}
              </span>
              {tile.freshness ? (
                <span className="flex items-center gap-1.5 font-mono text-[0.66rem] text-subtle">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: TILE_DOT_TONES[tile.freshness.kind],
                    }}
                  />
                  {tile.freshness.label}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {openSubject ? (
        <ProgressDetailPanel
          childId={childId}
          subject={openSubject}
          tile={openTile}
          conflicts={conflicts}
          timeZone={timeZone}
          allowDeeperCheck={deeperChecks}
          onClose={closePanel}
        />
      ) : null}
    </div>
  );
}
