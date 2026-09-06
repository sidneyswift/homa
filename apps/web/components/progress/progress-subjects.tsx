"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { ProgressTileModel } from "../../lib/child-progress/map-model";
import type {
  OpenProgressConflictView,
  ProgressSubjectView,
} from "../../lib/child-progress/types";
import { ProgressDetailPanel } from "./progress-detail-panel";
import { SubjectDoorContext } from "./subject-door-context";

/**
 * The merged subject surface (founder ask 2026-07-13): the snapshot
 * card's legend rows are the subject-by-subject list, and tapping one
 * opens the same detail panel the retired tile grid used. This client
 * host owns the open-panel state and provides the subject door; the
 * snapshot itself arrives as server-rendered children, so the content
 * bank never enters the browser bundle.
 */
export function ProgressSubjects({
  childId,
  initialSubjectId,
  subjects,
  tiles,
  conflicts,
  timeZone,
  deeperChecks,
  hoursMinutesBySubject,
  children,
}: {
  childId: string;
  initialSubjectId?: string;
  subjects: ProgressSubjectView[];
  /** Panel-header facts (badge) per subject, keyed by subjectId. */
  tiles: ProgressTileModel[];
  conflicts: readonly OpenProgressConflictView[];
  timeZone: string;
  /** False on read-only mirrors: hides the panel's deep-dive door. */
  deeperChecks: boolean;
  /** This school year's Hours minutes, keyed by subject id. Display-only. */
  hoursMinutesBySubject?: Readonly<Partial<Record<string, number>>>;
  children: ReactNode;
}) {
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(() => subjects.some(subject => subject.subjectId === initialSubjectId) ? initialSubjectId ?? null : null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // A full-height panel over a scrolled page: the page underneath stays
  // put while the panel is up (same rule as the tile grid had).
  useEffect(() => {
    if (openSubjectId === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [openSubjectId]);

  const door = useMemo(
    () => ({
      openSubjectId,
      openSubject(subjectId: string) {
        triggerRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setOpenSubjectId(subjectId);
      },
    }),
    [openSubjectId],
  );

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
    (triggerRef.current ?? document.getElementById("progress-heading"))?.focus();
  }

  return (
    <SubjectDoorContext.Provider value={door}>
      {children}
      {openSubject ? (
        <ProgressDetailPanel
          childId={childId}
          subject={openSubject}
          tile={openTile}
          conflicts={conflicts}
          timeZone={timeZone}
          allowDeeperCheck={deeperChecks}
          hoursMinutes={hoursMinutesBySubject?.[openSubject.subjectId] ?? null}
          onClose={closePanel}
        />
      ) : null}
    </SubjectDoorContext.Provider>
  );
}
