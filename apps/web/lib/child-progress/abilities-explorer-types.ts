import type { ProgressEvidenceAnswer } from "./types";

export const ABILITIES_EXPLORER_SUBJECTS = [
  "math",
  "literacy",
  "science",
] as const;

export type AbilitiesExplorerSubjectId =
  (typeof ABILITIES_EXPLORER_SUBJECTS)[number];

export type AbilitiesExplorerDisplayState =
  | "knows"
  | "working_on_now"
  | "up_next";

export interface AbilitiesExplorerEvidence {
  answer: ProgressEvidenceAnswer | null;
  source: string | null;
  observedAt: string | null;
  /** True when the map has two unresolved parent answers for this ability. */
  conflict: boolean;
}

export interface AbilitiesExplorerNode {
  id: string;
  name: string;
  description: string;
  subjectId: AbilitiesExplorerSubjectId;
  domainId: string;
  domainName: string;
  teachingWindowMonths: readonly [number, number];
  /** Deterministic coordinates in the subject graph's 0 to 1 viewport. */
  x: number;
  y: number;
  state: AbilitiesExplorerDisplayState;
  evidence: AbilitiesExplorerEvidence;
}

export interface AbilitiesExplorerEdge {
  /** The prerequisite node. */
  fromId: string;
  /** The node that builds on the prerequisite. */
  toId: string;
}

export interface AbilitiesExplorerSubject {
  id: AbilitiesExplorerSubjectId;
  displayName: string;
  nodes: readonly AbilitiesExplorerNode[];
  edges: readonly AbilitiesExplorerEdge[];
}

export interface AbilitiesExplorerPayload {
  childId: string;
  childName: string;
  /** Current age in months, used only for the display band. */
  ageMonths: number;
  /** The one shared curriculum axis. */
  axisMonths: readonly [number, number];
  /** The child's current one-year curriculum window. */
  ageRangeMonths: readonly [number, number];
  subjects: readonly AbilitiesExplorerSubject[];
}
