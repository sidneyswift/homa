import type { MapScores } from "@homa/core";

/**
 * The read-only slice of the live Progress view model, ported from
 * apps/web/lib/child-progress/types.ts (keep the shapes in sync with
 * that file until a shared package exists). Mobile renders the stored
 * projection from child_progress_live and never writes, so only the
 * view-side types travel; check-in, operation, and repository types
 * stay on the server.
 */

export type ProgressEvidenceAnswer =
  | "easily"
  | "getting_there"
  | "not_yet";

export type ProgressSourceKind =
  | "journal"
  | "conversation"
  | "check_in"
  | "checklist"
  | "deep_dive"
  | "correction"
  | "report_correction"
  | "report_probe"
  | "recheck"
  | "onboarding_walk"
  | "legacy"
  | "lesson_listen";

export interface ProgressEvidenceSourceView {
  kind: ProgressSourceKind;
  adultDisplayName: string | null;
  checkInId: string | null;
}

export type ProgressSubjectSummary =
  | {
      kind: "evidence";
      observedAt: string;
      source: ProgressEvidenceSourceView;
    }
  | {
      kind: "conflict";
      observedAt: string;
      adultDisplayNames: [string | null, string | null];
    };

export interface ProgressConflictAdultAnswerView {
  evidenceId: string;
  adultDisplayName: string | null;
  answer: ProgressEvidenceAnswer;
  observedAt: string;
  source: ProgressEvidenceSourceView;
}

/** An open disagreement with both observations preserved exactly. */
export interface OpenProgressConflictView {
  id: string;
  childId: string;
  familyId: string;
  itemId: string;
  adultAnswers: [
    ProgressConflictAdultAnswerView,
    ProgressConflictAdultAnswerView,
  ];
  observedAt: string;
  state: "open";
  resolvedAnswer: null;
  resolvedEvidenceId: null;
  resolvedAt: null;
}

interface ProgressTopicViewFields {
  itemId: string;
  statement: string;
  detail: string;
}

export interface ObservedTodayProgressTopicView
  extends ProgressTopicViewFields {
  state: "observed_today";
  answer: ProgressEvidenceAnswer;
  source: ProgressEvidenceSourceView;
  observedAt: string;
}

export interface OlderProgressTopicView extends ProgressTopicViewFields {
  state: "older";
  answer: ProgressEvidenceAnswer;
  source: ProgressEvidenceSourceView;
  observedAt: string;
}

export interface AskNextProgressTopicView extends ProgressTopicViewFields {
  state: "ask_next";
  answer: null;
  source: null;
  observedAt: null;
}

export interface ConflictProgressTopicView extends ProgressTopicViewFields {
  state: "conflict";
  answer: null;
  source: null;
  observedAt: string;
}

export type ProgressTopicView =
  | ObservedTodayProgressTopicView
  | OlderProgressTopicView
  | AskNextProgressTopicView
  | ConflictProgressTopicView;

export interface ProgressDomainView {
  domainId: string;
  displayName: string;
  topics: ProgressTopicView[];
}

export interface ProgressSubjectView {
  subjectId: string;
  displayName: string;
  evidenceCount: number;
  latestObservedAt: string | null;
  state: "updated_recently" | "older" | "conflict";
  summary: ProgressSubjectSummary | null;
  domains: ProgressDomainView[];
}

/** Serializable live read model, the same JSON the server stores. */
export interface ChildProgressView {
  childId: string;
  childName: string;
  birthDate: string;
  timeZone: string;
  projectedAt: string;
  scores: MapScores;
  subjects: ProgressSubjectView[];
  conflicts: OpenProgressConflictView[];
}
