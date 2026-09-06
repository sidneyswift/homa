"use client";

import { createContext, useContext } from "react";

/**
 * The subject door: how the snapshot card's legend rows open the
 * Progress page's subject detail panel (founder ask 2026-07-13: the
 * legend IS the subject-by-subject card, instead of a meaning box plus
 * a second tile grid). ProgressSubjects provides it; TrajectoryChart
 * consumes it. Outside a provider (the token report, the sample, the
 * admin mirror) the context is null and the chart keeps its own
 * pin-and-meaning-box behavior.
 */
export interface SubjectDoor {
  /** The subject whose panel is open right now; null when closed. */
  openSubjectId: string | null;
  openSubject: (subjectId: string) => void;
}

/** One legend row's live-progress facts, serializable server to client:
 * the row set (so subjects the chart cannot plot still get a door) and
 * the open-conflict flag the retired tile grid used to carry. */
export interface SubjectDoorRow {
  subjectId: string;
  displayName: string;
  needsConfirm: boolean;
  /** Live web comparison only, from the canonical view rather than an archive. */
  comparisonLabel?: string | null;
}

export const SubjectDoorContext = createContext<SubjectDoor | null>(null);

export function useSubjectDoor(): SubjectDoor | null {
  return useContext(SubjectDoorContext);
}
