import type { ProgressEvidenceAnswer, ProgressEvidenceDerivation } from "./types";

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
  | "unobserved"
  | "not_yet"
  | "conflict";

export interface AbilitiesExplorerEvidence {
  answer: ProgressEvidenceAnswer | null;
  derivation: ProgressEvidenceDerivation | null;
  source: string | null;
  observedAt: string | null;
  /** True when the map has two unresolved parent answers for this ability. */
  conflict: boolean;
  /** Each saved observation stays separate while the conflict is unresolved. */
  conflictingAnswers: readonly {
    answer: ProgressEvidenceAnswer;
    derivation: ProgressEvidenceDerivation;
    observedAt: string;
  }[];
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
  /** Authenticated projection time zone for age and evidence dates. */
  timeZone: string;
  /** Current age in months, used only for the display band. */
  ageMonths: number;
  /** The one shared curriculum axis. */
  axisMonths: readonly [number, number];
  /** One-year plotting window, clamped to the axis. Hide when age is outside it. */
  ageRangeMonths: readonly [number, number];
  subjects: readonly AbilitiesExplorerSubject[];
}
