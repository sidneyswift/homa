import type { MapAnswer } from "@homa/core";

export type ProgressEvidenceAnswer =
  | "easily"
  | "getting_there"
  | "not_yet";

export type ProgressSourceKind =
  | "journal"
  | "conversation"
  | "check_in"
  | "checklist"
  | "correction"
  | "legacy";

export interface ProgressSelectionAnswer {
  evidenceId: string;
  itemId: string;
  answer: MapAnswer;
  answeredAt: string;
}

export interface ProgressSelectionInput {
  ageMonths: number;
  subjectIds?: readonly string[];
  answers: readonly ProgressSelectionAnswer[];
}
