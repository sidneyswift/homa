import type { MapAnswer, MapScores } from "@homa/core";

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

export interface ProgressSelectionAnswer {
  selectionId: string;
  evidenceId: string | null;
  itemId: string;
  answer: MapAnswer;
  answeredAt: string;
}

export interface ProgressSelectionInput {
  ageMonths: number;
  subjectIds?: readonly string[];
  answers: readonly ProgressSelectionAnswer[];
  allowRefresh?: boolean;
}

export type ProgressCheckInPurpose =
  | "whole_map_refresh"
  | "subject_deep_dive"
  | "age_refresh"
  | "journal_followup";

export type ProgressCheckInState =
  | "active"
  | "paused"
  | "completed"
  | "stopped";

export type ProgressCheckInPauseReason =
  | "topic_change"
  | "explicit_pause"
  | "delivery_uncertain"
  | "delivery_failed"
  | "conflict"
  | "member_removed";

/** Where progress provenance can point. Check-ins use the first five;
 * "lesson" exists only on evidence and observation rows written by the
 * lesson listen pipeline (plan 2026-07-13-lesson-listen.md), never on
 * a check-in. */
export type ProgressCheckInChannel =
  | "web"
  | "sms"
  | "email"
  | "dispatch"
  | "voice"
  | "lesson";

export interface ProgressCheckInScope {
  subjectIds?: string[];
}

export interface ProgressCheckInRecord {
  id: string;
  childId: string;
  childName: string;
  familyId: string;
  purpose: ProgressCheckInPurpose;
  scope: ProgressCheckInScope;
  state: ProgressCheckInState;
  ownerMemberUserId: string | null;
  ownerDisplayName: string | null;
  recipientMemberUserId: string | null;
  recipientDisplayName: string | null;
  revision: number;
  currentItemId: string | null;
  currentDeliveryId: string | null;
  episodeId: string | null;
  pendingRuntimeSessionId: string | null;
  pendingTurnId: string | null;
  pauseReason: ProgressCheckInPauseReason | null;
  openedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  stoppedAt: string | null;
  updatedAt: string;
}

export interface ProgressCheckInPrompt {
  checkInId: string;
  revision: number;
  childId: string;
  childName: string;
  itemId: string;
  personalizedStatement: string;
  subjectDisplayName: string;
  state: ProgressCheckInState;
  ownerDisplayName: string | null;
}

export interface ProgressCheckInContext {
  familyId: string;
  memberUserId: string | null;
  channel: ProgressCheckInChannel;
  providerMessageId: string | null;
  repliedDeliveryId: string | null;
  /** Server-resolved active workflow for an authenticated SMS destination. */
  activeProgressCheckInId?: string | null;
  episodeId: string | null;
  runtimeSessionId: string;
  turnId: string;
  canonicalInboundText: string | null;
  inboundMessageId: string | null;
  /** Dispatch sessions carry their task run for observation provenance. */
  taskRunId?: string | null;
  now: string;
}

export interface ProgressConflictCardAnswer {
  evidenceId: string;
  answer: ProgressEvidenceAnswer;
  adultDisplayName: string | null;
  observedAt: string;
  source: ProgressSourceKind;
}

export interface ProgressConflictCard {
  id: string;
  childId: string;
  childName: string;
  itemId: string;
  skillStatement: string;
  subjectDisplayName: string;
  answers: [
    ProgressConflictCardAnswer,
    ProgressConflictCardAnswer,
  ];
}

export interface ProgressCheckInUpdate {
  operationId: string;
  affectedItemIds: string[];
  affectedTopics: string[];
  undoAvailable: true;
}

export type ProgressCheckInResponseOutcome =
  | {
      status: "advanced";
      checkIn: ProgressCheckInRecord;
      prompt: ProgressCheckInPrompt;
      responseId: string;
      progressUpdate?: ProgressCheckInUpdate;
    }
  | {
      status: "completed";
      checkIn: ProgressCheckInRecord;
      responseId: string;
      progressUpdate?: ProgressCheckInUpdate;
    }
  | {
      status: "conflict_open";
      checkIn: ProgressCheckInRecord;
      conflict: ProgressConflictCard;
      responseId: string;
    };

export interface ProgressConflictResolvedOutcome {
  status: "conflict_resolved";
  conflictId: string;
  selectedEvidenceId: string;
  checkIn: ProgressCheckInRecord | null;
  prompt: ProgressCheckInPrompt | null;
}

export type ProgressCheckInBindResult =
  | {
      status: "bound";
      checkIn: ProgressCheckInRecord;
    }
  | { status: "stale_prompt" }
  | { status: "no_active_check_in" }
  | { status: "wrong_recipient" }
  | { status: "wrong_delivery" };

export type ProgressCheckInResult =
  | {
      status: "started";
      checkIn: ProgressCheckInRecord;
      prompt: ProgressCheckInPrompt;
    }
  | {
      status: "existing";
      checkIn: ProgressCheckInRecord;
      prompt: ProgressCheckInPrompt | null;
    }
  | ProgressCheckInResponseOutcome
  | {
      status: "paused";
      checkIn: ProgressCheckInRecord;
      prompt: ProgressCheckInPrompt;
    }
  | {
      status: "resumed";
      checkIn: ProgressCheckInRecord;
      prompt: ProgressCheckInPrompt;
    }
  | {
      status: "stopped";
      checkIn: ProgressCheckInRecord;
    }
  | {
      status: "takeover_accepted";
      checkIn: ProgressCheckInRecord;
      prompt: ProgressCheckInPrompt;
    }
  | {
      status: "duplicate";
      original:
        | ProgressCheckInResponseOutcome
        | ProgressConflictResolvedOutcome;
    }
  | ProgressConflictResolvedOutcome
  | { status: "unknown_child" }
  | { status: "no_active_check_in" }
  | { status: "stale_prompt" }
  | { status: "wrong_recipient" }
  | { status: "wrong_delivery" }
  | { status: "idempotency_mismatch" }
  | {
      status: "conflict_pending";
      conflictId: string;
    }
  | { status: "invalid_scope" };

/** One immutable, evidence-bearing observation from the progress ledger. */
export interface ProgressEvidence {
  id: string;
  childId: string;
  familyId: string;
  itemId: string;
  answer: ProgressEvidenceAnswer;
  source: ProgressSourceKind;
  memberUserId: string | null;
  adultDisplayName: string | null;
  quote: string | null;
  channel: ProgressCheckInChannel | null;
  messageId: string | null;
  checkInId: string | null;
  supersedesId: string | null;
  supersededAt: string | null;
  observedAt: string;
  createdAt: string;
}

interface ProgressConflictFields {
  id: string;
  childId: string;
  familyId: string;
  itemId: string;
  evidenceIdA: string;
  evidenceIdB: string;
  /** When the differing observations became a conflict. */
  observedAt: string;
}

export interface OpenProgressConflict extends ProgressConflictFields {
  state: "open";
  resolvedAnswer: null;
  resolvedEvidenceId: null;
  resolvedAt: null;
}

export interface ResolvedProgressConflict extends ProgressConflictFields {
  state: "resolved";
  resolvedAnswer: ProgressEvidenceAnswer;
  resolvedEvidenceId: string;
  resolvedAt: string;
}

/** A disagreement whose adult display data is read from linked evidence. */
export type ProgressConflict =
  | OpenProgressConflict
  | ResolvedProgressConflict;

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

interface ProgressConflictViewFields {
  id: string;
  childId: string;
  familyId: string;
  itemId: string;
  adultAnswers: [
    ProgressConflictAdultAnswerView,
    ProgressConflictAdultAnswerView,
  ];
  observedAt: string;
}

export interface OpenProgressConflictView
  extends ProgressConflictViewFields {
  state: "open";
  resolvedAnswer: null;
  resolvedEvidenceId: null;
  resolvedAt: null;
}

/** Current conflict data with both observations preserved exactly. */
export type ProgressConflictView = OpenProgressConflictView;

interface ProgressTopicViewFields {
  itemId: string;
  statement: string;
  detail: string;
}

interface EvidenceProgressTopicViewFields
  extends ProgressTopicViewFields {
  answer: ProgressEvidenceAnswer;
  source: ProgressEvidenceSourceView;
  observedAt: string;
}

export interface ObservedTodayProgressTopicView
  extends EvidenceProgressTopicViewFields {
  state: "observed_today";
}

export interface OlderProgressTopicView
  extends EvidenceProgressTopicViewFields {
  state: "older";
}

export interface AskNextProgressTopicView
  extends ProgressTopicViewFields {
  state: "ask_next";
  answer: null;
  source: null;
  observedAt: null;
}

export interface ConflictProgressTopicView
  extends ProgressTopicViewFields {
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

/** Serializable live read model shared by server readers and the UI. */
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
