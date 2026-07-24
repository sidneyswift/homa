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
  /** From the add-a-child card (or a past extras step); when either is
   * already filled the extras step never re-asks (founder call
   * 2026-07-08: the kid card collects these up front now). */
  interests: string[];
  helpWith: string | null;
}

export type FlowPhase =
  | "loading"
  | "bootstrap-error"
  | "parent"
  /** Chat-first onboarding: everything after the account is a
   *  conversation (plans/2026-07-21-chat-first-onboarding.md). Only
   *  reachable behind HOMA_CHAT_ONBOARDING. */
  | "chat"
  | "family"
  | "homeschool"
  | "kids"
  | "hub"
  | "preparing"
  | "checklist"
  | "extras"
  | "next-kid"
  | "deepdive"
  | "scoring";
