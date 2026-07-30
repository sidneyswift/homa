import type { MapScores } from "@homa/core";

import { supabase } from "./supabase";

/**
 * Types and reads for Homa's live Progress feature, ported from
 * apps/web/lib/child-progress/types.ts (keep shapes in sync with that
 * file until a shared package exists, same rule as family.ts). Mobile
 * reads the same pre-built ChildProgressView the web page renders
 * (child_progress_live.projection, RLS-scoped to the caller's family)
 * rather than re-deriving it from raw evidence: that derivation depends
 * on @homa/core's scoreMap plus @homa/taxonomy's domain/topic lookups,
 * which this app does not carry.
 */

export type ProgressEvidenceAnswer = "easily" | "getting_there" | "not_yet";

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
  | { kind: "evidence"; observedAt: string; source: ProgressEvidenceSourceView }
  | { kind: "conflict"; observedAt: string; adultDisplayNames: [string | null, string | null] };

interface ProgressTopicViewFields {
  itemId: string;
  statement: string;
  detail: string;
}

interface EvidenceProgressTopicViewFields extends ProgressTopicViewFields {
  answer: ProgressEvidenceAnswer;
  source: ProgressEvidenceSourceView;
  observedAt: string;
}

export interface ObservedTodayProgressTopicView extends EvidenceProgressTopicViewFields {
  state: "observed_today";
}

export interface OlderProgressTopicView extends EvidenceProgressTopicViewFields {
  state: "older";
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

export interface ProgressConflictAdultAnswerView {
  evidenceId: string;
  adultDisplayName: string | null;
  answer: ProgressEvidenceAnswer;
  observedAt: string;
  source: ProgressEvidenceSourceView;
}

export interface OpenProgressConflictView {
  id: string;
  childId: string;
  familyId: string;
  itemId: string;
  adultAnswers: [ProgressConflictAdultAnswerView, ProgressConflictAdultAnswerView];
  observedAt: string;
  state: "open";
  resolvedAnswer: null;
  resolvedEvidenceId: null;
  resolvedAt: null;
}

/** Serializable live read model, identical shape to web's ChildProgressView. */
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

/**
 * Reads child_progress_live.projection for one child. Returns null when
 * no row exists yet (the child has never been scored/assessed), which
 * the screen renders as its own "never assessed" state, not an error.
 */
export async function getChildProgressView(childId: string): Promise<ChildProgressView | null> {
  const { data, error } = await supabase
    .from("child_progress_live")
    .select("projection")
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw new Error(`progress read failed: ${error.message}`);
  if (!data) return null;
  return data.projection as ChildProgressView;
}
