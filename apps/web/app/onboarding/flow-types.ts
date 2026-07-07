import type { MapAnswer } from "@homa/core";

/**
 * Client-side shapes for the map flow. The server is the source of truth;
 * these mirror /api/map/state's response plus local-only UI state.
 * Question plans are computed locally with planQuestions() from the bank.
 */

export interface FlowChild {
  id: string;
  name: string;
  ageMonths: number;
  inRange: boolean;
  reportToken: string | null;
  answers: Record<string, MapAnswer>;
  /** Count of saved answers, for the hub's "12 answers saved" line. */
  answered: number;
}

export type FlowPhase =
  | "loading"
  | "bootstrap-error"
  | "parent"
  | "kids"
  | "hub"
  | "checklist"
  | "extras"
  | "next-kid"
  | "signup"
  | "deepdive"
  | "scoring";
